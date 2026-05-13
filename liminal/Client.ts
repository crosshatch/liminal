import {
  Context,
  Encoding,
  Deferred,
  Effect,
  Layer,
  Option,
  PubSub,
  RcRef,
  Record,
  pipe,
  Ref,
  Scope,
  Stream,
  Take,
  Schema as S,
  Array,
  Fiber,
  Exit,
  Cause,
  Result,
  flow,
  Tracer,
  identity,
  Semaphore,
} from "effect"
import { Socket } from "effect/unstable/socket"
import { Worker } from "effect/unstable/workers"
import * as Spanner from "liminal-util/Spanner"

import { decodeJsonString, encodeJsonString } from "./_util/schema.ts"
import { type ClientError, AuditionError, ConnectionError, UnresolvedError } from "./errors.ts"
import type { Fn, FnError } from "./Fn.ts"
import { Protocol, type ProtocolDefinition } from "./Protocol.ts"
import * as Reducer from "./Reducer.ts"
import * as Tracing from "./Tracing.ts"

const span = Spanner.make(import.meta.url)

export const TypeId = "~liminal/Client" as const

export interface ReplayConfig {
  readonly mode: "startup" | "all-subscribers"

  readonly limit?: number | undefined
}

interface EventTake<A, E> {
  readonly seq: number

  readonly take: Take.Take<A, E>
}

export type Service<ClientSelf, D extends ProtocolDefinition> = RcRef.RcRef<
  {
    readonly state: Stream.Stream<S.Struct<D["state"]>["Type"], ClientError | S.SchemaError>

    readonly events: Stream.Stream<ReturnType<typeof S.TaggedUnion<D["events"]>>["Type"], ClientError | S.SchemaError>

    readonly fn: <K extends keyof D["methods"]>(
      tag: K,
      payload: D["methods"][K]["payload"]["Type"],
    ) => Effect.Effect<D["methods"][K]["success"]["Type"], D["methods"][K]["failure"]["Type"], ClientSelf>

    readonly end: Effect.Effect<void>
  },
  ClientError
>

export interface Client<Self, ClientId extends string, D extends ProtocolDefinition> extends Context.Service<
  Self,
  Service<Self, D>
> {
  new (_: never): Context.ServiceClass.Shape<ClientId, Service<Self, D>>

  readonly [TypeId]: typeof TypeId

  readonly definition: D

  readonly protocol: Protocol<D>

  readonly state: Stream.Stream<
    S.Struct<D["state"]>["Type"],
    ClientError | S.SchemaError,
    Self | S.Struct<D["state"]>["DecodingServices"]
  >

  readonly events: Stream.Stream<
    ReturnType<typeof S.TaggedUnion<D["events"]>>["Type"],
    ClientError | S.SchemaError,
    Self
  >

  readonly fn: Fn<Self, D["methods"]>

  readonly invalidate: Effect.Effect<void, never, Self>

  readonly reducer: <K extends keyof D["events"], R extends Reducer.Reducer<D, K>>(_tag: K, f: R) => R
}

export const Service =
  <Self>() =>
  <Id extends string, D extends ProtocolDefinition>(id: Id, definition: D): Client<Self, Id, D> => {
    const tag = Context.Service<Self, Service<Self, D>>()(id)

    const protocol = Protocol(definition)

    const state = tag.asEffect().pipe(
      Effect.flatMap(RcRef.get),
      Effect.map(({ state }) => state),
      Stream.unwrap,
    )

    const events = tag.asEffect().pipe(
      Effect.flatMap(RcRef.get),
      Effect.map(({ events }) => events),
      Stream.unwrap,
    )

    const fn = ((_tag: keyof D["methods"], ...f: Array<any>) =>
      Effect.fnUntraced(
        function* (payload: any) {
          const { fn } = yield* tag.asEffect().pipe(Effect.flatMap(RcRef.get))
          return yield* fn(_tag, payload)
        },
        Effect.scoped,
        ...(f as [any]),
      )) as Fn<Self, D["methods"]>

    const invalidate = tag.asEffect().pipe(
      Effect.flatMap((rc) =>
        RcRef.get(rc).pipe(
          Effect.flatMap(({ end }) => end),
          Effect.andThen(RcRef.invalidate(rc)),
        ),
      ),
      Effect.scoped,
      Effect.ignore,
    )

    const reducer = <K extends keyof D["events"], R extends Reducer.Reducer<D, K>>(_event: K, f: R) => f

    return Object.assign(tag, {
      [TypeId]: TypeId,
      definition,
      protocol,
      state,
      events,
      fn,
      invalidate,
      reducer,
    })
  }

export interface ClientTransport<D extends ProtocolDefinition, ReducerR> {
  readonly listen: (
    publish: (message: Protocol<D>["Actor"]["Type"]) => Effect.Effect<void, ClientError, ReducerR>,
  ) => Effect.Effect<
    void,
    ClientError | S.SchemaError,
    Scope.Scope | Protocol<D>["Actor"]["DecodingServices"] | ReducerR
  >

  readonly send: (
    message: Protocol<D>["F"]["Payload"]["Type"],
  ) => Effect.Effect<void, ClientError | S.SchemaError, Protocol<D>["F"]["Payload"]["EncodingServices"]>
}

const make = <Self, Id extends string, D extends ProtocolDefinition, Reducers extends Reducer.Reducers<D>, R>(
  client: Client<Self, Id, D>,
  reducers: Reducers,
  build: Effect.Effect<ClientTransport<D, Reducer.Reducers.Services<Self, Reducers>>, ClientError, R | Scope.Scope>,
  replay?: ReplayConfig | undefined,
) =>
  Effect.gen(function* () {
    const rcr: Service<Self, D> = yield* RcRef.make({
      acquire: Effect.gen(function* () {
        type _ = typeof client.protocol
        type Event = ReturnType<typeof S.TaggedUnion<D["events"]>>["Type"]

        const { listen, send } = yield* build

        const audition = yield* Deferred.make<void>()
        const stateDeferred = yield* Deferred.make<Ref.Ref<S.Struct<D["state"]>["Type"]>>()

        const inflights: Record<
          string,
          {
            readonly deferred: Deferred.Deferred<_["F"]["Success"]["Type"], FnError<D["methods"]>>
            readonly span?: Tracer.AnySpan | undefined
          }
        > = {}
        let callId = 0
        let takeCount = 0
        const eventsPubsub = yield* PubSub.unbounded<EventTake<Event, ClientError>>()
        const statePubsub = yield* PubSub.unbounded<S.Struct<D["state"]>["Type"]>({ replay: 1 })

        const replayState = yield* Ref.make<{
          readonly startupOpen: boolean
          readonly buffer: ReadonlyArray<EventTake<Event, ClientError>>
        }>({
          startupOpen: true,
          buffer: [],
        })

        const publishTake = (take: Take.Take<Event, ClientError>, replayable?: boolean | undefined) =>
          Effect.gen(function* () {
            const eventTake: EventTake<Event, ClientError> = {
              seq: takeCount++,
              take,
            }
            if (replay && replayable) {
              yield* Ref.update(replayState, (state) => {
                if (replay.mode === "startup" && !state.startupOpen) {
                  return state
                }
                const buffer =
                  replay.limit === undefined
                    ? [...state.buffer, eventTake]
                    : [...(state.buffer.length >= replay.limit ? state.buffer.slice(1) : state.buffer), eventTake]
                const { startupOpen } = state
                return { startupOpen, buffer }
              })
            }
            yield* PubSub.publish(eventsPubsub, eventTake)
          })

        const outer = yield* Scope.Scope
        const scope = yield* Scope.fork(outer, "sequential")
        const end = Scope.close(scope, Exit.void)
        const reduceMutex = yield* Semaphore.make(1)
        const reduceTask = Semaphore.withPermits(reduceMutex, 1)

        const fiber = yield* listen(
          Effect.fnUntraced(function* (message) {
            switch (message._tag) {
              case "Audition.Success": {
                const { initial } = message
                yield* PubSub.publish(statePubsub, initial)
                const state = yield* Ref.make(initial)
                yield* Deferred.succeed(stateDeferred, state)
                yield* Deferred.succeed(audition, void 0)
                return
              }
              case "Audition.Failure": {
                const { expected, actual } = message
                return yield* new AuditionError({ value: { expected, actual } })
              }
              case "Event": {
                const { event } = message
                const { _tag } = event as never
                const reducer = reducers[_tag]!
                const state = yield* Deferred.await(stateDeferred)
                yield* Effect.gen(function* () {
                  const current = yield* Ref.get(state)
                  const next = yield* reducer(event as never)(current).pipe(
                    Effect.provideService(client, rcr),
                    Effect.tap((state) => PubSub.publish(statePubsub, state)),
                    reduceTask,
                  ) as Effect.Effect<S.Struct<D["state"]>["Type"], never, Reducer.Reducers.Services<Self, Reducers>>
                  yield* Ref.set(state, next)
                }).pipe(reduceTask)
                const parent = message.trace ? Tracer.externalSpan(message.trace) : undefined
                yield* publishTake([event], true).pipe(
                  span("event.enqueue", {
                    attributes: { _tag },
                    kind: "consumer",
                    parent,
                  }),
                )
                return
              }
              case "F.Success":
              case "F.Failure": {
                const { id } = message
                const inflight = inflights[id]
                if (inflight) {
                  delete inflights[id]
                  return yield* Effect.gen(function* () {
                    switch (message._tag) {
                      case "F.Success": {
                        const { value } = message.success as never
                        yield* Deferred.succeed(inflight.deferred, value)
                        return
                      }
                      case "F.Failure": {
                        const { _tag, value } = message.failure as never
                        yield* Effect.annotateLogs(Effect.logDebug("Call.Failed"), { id, _tag })
                        yield* Deferred.fail(inflight.deferred, value)
                        return
                      }
                    }
                  }).pipe(inflight.span ? Effect.withParentSpan(inflight.span, { captureStackTrace: false }) : identity)
                }
                return
              }
              case "Disconnect": {
                return
              }
            }
          }),
        ).pipe(
          Effect.ensuring(
            Effect.all(
              [
                Effect.sync(() => Record.keys(inflights).length).pipe(
                  Effect.flatMap((unresolved) =>
                    unresolved === 0
                      ? Effect.void
                      : Effect.annotateLogs(Effect.logDebug("Client.Closed"), { unresolved }),
                  ),
                ),
                Deferred.succeed(audition, void 0),
                RcRef.invalidate(rcr),
              ],
              { concurrency: "unbounded" },
            ),
          ),
          Effect.forkScoped,
          Effect.provideService(Scope.Scope, scope),
        )

        const events = Effect.gen(function* () {
          const queue = yield* PubSub.subscribe(eventsPubsub)
          const live = (replayCount: number) =>
            Stream.fromSubscription(queue).pipe(
              Stream.filter((entry) => entry.seq > replayCount),
              Stream.map((entry) => entry.take),
              Stream.flattenTake,
            )
          if (!replay) {
            return live(-1)
          }
          const buffer =
            replay.mode === "all-subscribers"
              ? (yield* Ref.get(replayState)).buffer
              : yield* Ref.modify(replayState, (state) =>
                  state.startupOpen
                    ? [
                        state.buffer,
                        {
                          startupOpen: false,
                          buffer: [],
                        },
                      ]
                    : [[], state],
                )
          const replayCount = Array.get(buffer, buffer.length - 1).pipe(
            Option.map(({ seq }) => seq),
            Option.getOrElse(() => -1),
          )
          return buffer.length === 0
            ? live(replayCount)
            : Stream.concat(
                Stream.fromIterable(buffer).pipe(
                  Stream.map((entry) => entry.take),
                  Stream.flattenTake,
                ),
                live(replayCount),
              )
        }).pipe(
          Stream.unwrap,
          Stream.interruptWhen(
            Fiber.await(fiber).pipe(
              Effect.flatMap(
                Exit.match({
                  onSuccess: () => Effect.void,
                  onFailure: flow(
                    Cause.findError,
                    Result.match({
                      onSuccess: Effect.fail,
                      onFailure: () => Effect.void,
                    }),
                  ),
                }),
              ),
            ),
          ),
        )

        const state = Stream.fromPubSub(statePubsub)

        const encodingServices = yield* Effect.context<_["F"]["Payload"]["EncodingServices"]>()

        yield* Deferred.await(audition)

        const fn = <K extends keyof D["methods"]>(_tag: K, value: D["methods"][K]["payload"]["Type"]) =>
          Effect.gen(function* () {
            const exit = fiber.pollUnsafe()
            if (exit) {
              return yield* Exit.match(exit, {
                onSuccess: () => new UnresolvedError(),
                onFailure: flow(
                  Cause.findError,
                  Result.match({
                    onSuccess: Effect.fail,
                    onFailure: () => new UnresolvedError(),
                  }),
                ),
              })
            }
            const id = callId++
            const deferred = yield* Deferred.make<_["F"]["Success"]["Type"], FnError<D["methods"]>>()
            const span = yield* Tracing.current
            const trace = span ? Tracing.toTraceEnvelope(span) : undefined
            inflights[id] = { deferred, span }
            yield* send({
              _tag: "F.Payload",
              id,
              payload: { _tag, value } as never,
              ...(trace && { trace }),
            })
            return yield* Effect.raceFirst(
              Deferred.await(deferred),
              Fiber.await(fiber).pipe(
                Effect.flatMap(
                  (exit): Effect.Effect<never, ClientError | UnresolvedError | S.SchemaError> =>
                    Exit.match(exit, {
                      onSuccess: () => new UnresolvedError().asEffect(),
                      onFailure: flow(
                        Cause.findError,
                        Result.match({
                          onSuccess: Effect.fail,
                          onFailure: () => new UnresolvedError().asEffect(),
                        }),
                      ),
                    }),
                ),
              ),
            )
          }).pipe(
            span("f", {
              kind: "client",
              attributes: { _tag },
            }),
            Effect.provide(encodingServices),
          )

        return { state, events, fn, end }
      }).pipe(span("acquire", { attributes: { client: client.key } }), Effect.annotateLogs("client", client.key)),
    })

    return rcr
  }).pipe(Layer.effect(client))

export const layerSocket = <
  Self,
  Id extends string,
  D extends ProtocolDefinition,
  Reducers extends Reducer.Reducers<D>,
>({
  client,
  reducers,
  url,
  protocols,
  replay,
}: {
  readonly client: Client<Self, Id, D>
  readonly reducers: Reducers
  readonly url?: string | undefined
  readonly protocols?: string | Array<string> | undefined
  readonly replay?: ReplayConfig | undefined
}): Layer.Layer<
  Self,
  never,
  | Socket.WebSocketConstructor
  | Protocol<D>["Actor"]["DecodingServices"]
  | Protocol<D>["F"]["Payload"]["EncodingServices"]
  | Reducer.Reducers.Services<Self, Reducers>
> => {
  const { F, Actor } = client.protocol
  const encodeFPayload = encodeJsonString(F.Payload)
  const decodeActor = decodeJsonString(Actor)

  return make<Self, Id, D, Reducers, Socket.WebSocketConstructor>(
    client,
    reducers,
    Effect.gen(function* () {
      const socket = yield* Socket.makeWebSocket(url ?? "/", {
        protocols: ["liminal", Encoding.encodeBase64Url(client.key), ...(protocols ? Array.ensure(protocols) : [])],
      })
      return {
        listen: Effect.fnUntraced(function* (publish) {
          yield* socket
            .runRaw((raw) =>
              pipe(
                raw instanceof Uint8Array ? new TextDecoder().decode(raw) : raw,
                decodeActor,
                Effect.andThen(publish),
              ),
            )
            .pipe(
              Effect.catchIf(
                Socket.isSocketError,
                Effect.fnUntraced(function* (cause) {
                  const { reason } = cause
                  if (reason._tag === "SocketCloseError" && reason.code === 1000) {
                    return yield* publish({ _tag: "Disconnect" })
                  }
                  yield* Effect.annotateLogs(Effect.logDebug(`SocketErrored.${reason._tag}`), { cause })
                  return yield* new ConnectionError({ cause })
                }),
              ),
            )
        }, span("listen")),
        send: Effect.fnUntraced(
          function* (v) {
            const write = yield* socket.writer
            const message = yield* encodeFPayload(v)
            yield* write(message).pipe(
              Effect.catchTag("SocketError", (cause) => new ConnectionError({ cause }).asEffect()),
            )
          },
          span("send"),
          Effect.scoped,
        ),
      }
    }),
    replay,
  )
}

export const layerWorker = <
  Self,
  Id extends string,
  D extends ProtocolDefinition,
  Reducers extends Reducer.Reducers<D>,
  T extends Protocol<D>,
>({
  client,
  reducers,
  replay,
}: {
  readonly client: Client<Self, Id, D>
  readonly reducers: Reducers
  readonly replay?: ReplayConfig | undefined
}): Layer.Layer<
  Self,
  never,
  | Worker.WorkerPlatform
  | Worker.Spawner
  | T["Actor"]["DecodingServices"]
  | T["F"]["Payload"]["EncodingServices"]
  | Reducer.Reducers.Services<Self, Reducers>
> =>
  make<Self, Id, D, Reducers, Worker.WorkerPlatform | Worker.Spawner>(
    client,
    reducers,
    Effect.gen(function* () {
      const platform = yield* Worker.WorkerPlatform
      const backing = yield* platform
        .spawn<T["Actor"]["Type"], T["Client"]["Type"]>(0)
        .pipe(Effect.catchTag("WorkerError", (cause) => new ConnectionError({ cause }).asEffect()))

      const send = (message: T["Client"]["Type"]) =>
        backing.send(message).pipe(
          Effect.catchTag("WorkerError", (cause) => new ConnectionError({ cause }).asEffect()),
          span("send"),
        )

      return {
        listen: Effect.fnUntraced(function* (publish) {
          const stop = yield* Deferred.make<void>()
          yield* backing
            .run(
              Effect.fnUntraced(function* (message) {
                yield* publish(message)
                if (message._tag === "Disconnect" || message._tag === "Audition.Failure") {
                  yield* Deferred.succeed(stop, void 0)
                }
              }),
              {
                onSpawn: backing
                  .send({
                    _tag: "Audition.Payload",
                    client: client.key,
                  })
                  .pipe(Effect.orDie),
              },
            )
            .pipe(
              Effect.raceFirst(Deferred.await(stop)),
              Effect.catchTag("WorkerError", (cause) => new ConnectionError({ cause }).asEffect()),
            )
        }, span("listen")),
        send,
      }
    }),
    replay,
  )
