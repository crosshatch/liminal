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
  Struct,
  Fiber,
  Exit,
  Cause,
  Result,
  flow,
} from "effect"
import { Socket } from "effect/unstable/socket"
import { Worker } from "effect/unstable/workers"

import * as Diagnostic from "./_util/Diagnostic.ts"
import { decodeJsonString, encodeJsonString } from "./_util/schema.ts"
import { type ClientError, AuditionError, ConnectionError, type FError, UnresolvedError } from "./errors.ts"
import { type F } from "./F.ts"
import { Protocol, type ProtocolDefinition } from "./Protocol.ts"

const { debug, span } = Diagnostic.module("Client")

export const TypeId = "~liminal/Client" as const

export interface ReplayConfig {
  readonly mode: "startup" | "all-subscribers"

  readonly limit?: number | undefined
}

interface EventTake<A, E> {
  readonly seq: number

  readonly take: Take.Take<A, E>
}

export interface Session<Self, D extends ProtocolDefinition> {
  readonly events: Stream.Stream<ReturnType<typeof S.TaggedUnion<D["events"]>>["Type"], ClientError | S.SchemaError>

  readonly f: F<Self, D>

  readonly end: Effect.Effect<void>
}

export type Service<ClientSelf, D extends ProtocolDefinition> = RcRef.RcRef<Session<ClientSelf, D>, ClientError>

export interface Client<Self, ClientId extends string, D extends ProtocolDefinition> extends Context.Service<
  Self,
  Service<Self, D>
> {
  new (_: never): Context.ServiceClass.Shape<ClientId, Service<Self, D>>

  readonly [TypeId]: typeof TypeId

  readonly definition: D

  readonly protocol: Protocol<D>

  readonly events: Stream.Stream<
    ReturnType<typeof S.TaggedUnion<D["events"]>>["Type"],
    ClientError | S.SchemaError,
    Self
  >

  readonly f: F<Self, D>

  readonly invalidate: Effect.Effect<void, never, Self>
}

export const Service =
  <Self>() =>
  <Id extends string, D extends ProtocolDefinition>(id: Id, definition: D): Client<Self, Id, D> => {
    const tag = Context.Service<Self, Service<Self, D>>()(id)

    const protocol = Protocol(definition)

    const events = tag.asEffect().pipe(Effect.flatMap(RcRef.get), Effect.map(Struct.get("events")), Stream.unwrap)

    const f: F<Self, D> = (_tag) =>
      Effect.fnUntraced(function* (value) {
        const { f } = yield* tag.asEffect().pipe(Effect.flatMap(RcRef.get))
        return yield* f(_tag)(value)
      }, Effect.scoped)

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

    return Object.assign(tag, {
      [TypeId]: TypeId,
      definition,
      protocol,
      events,
      f,
      invalidate,
    })
  }

export interface ClientTransport<D extends ProtocolDefinition> {
  readonly listen: (
    publish: (message: Protocol<D>["Actor"]["Type"]) => Effect.Effect<void, ClientError>,
  ) => Effect.Effect<void, ClientError | S.SchemaError, Scope.Scope | Protocol<D>["Actor"]["DecodingServices"]>

  readonly send: (
    message: Protocol<D>["F"]["Payload"]["Type"],
  ) => Effect.Effect<void, ClientError | S.SchemaError, Protocol<D>["F"]["Payload"]["EncodingServices"]>
}

const make = <Self, Id extends string, D extends ProtocolDefinition, R>(
  client: Client<Self, Id, D>,
  build: Effect.Effect<ClientTransport<D>, ClientError, R | Scope.Scope>,
  replay?: ReplayConfig | undefined,
) =>
  Effect.gen(function* () {
    const rcr: RcRef.RcRef<Session<Self, D>, ClientError> = yield* RcRef.make({
      acquire: Effect.gen(function* () {
        type _ = typeof client.protocol
        type Event = ReturnType<typeof S.TaggedUnion<D["events"]>>["Type"]

        yield* debug("AcquisitionStarted")

        const { listen, send } = yield* build

        const audition = yield* Deferred.make<void>()

        const inflights: Record<string, Deferred.Deferred<_["F"]["Success"]["Type"], FError<D>>> = {}
        let callId = 0
        let takeCount = 0
        const pubsub = yield* PubSub.unbounded<EventTake<Event, ClientError>>()

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
            yield* PubSub.publish(pubsub, eventTake)
          })

        const outer = yield* Scope.Scope
        const scope = yield* Scope.fork(outer, "sequential")
        const end = Scope.close(scope, Exit.void)

        const fiber = yield* listen(
          Effect.fnUntraced(function* (message) {
            switch (message._tag) {
              case "Audition.Success": {
                yield* debug("Audition.Succeeded")
                yield* Deferred.succeed(audition, void 0)
                return
              }
              case "Audition.Failure": {
                const { client, routed } = message
                yield* debug("Audition.Failed", { client, routed })
                return yield* new AuditionError({ value: { client, routed } })
              }
              case "Event": {
                const { event } = message
                yield* debug("Event.Emitted", { event })
                yield* publishTake([event as never], true)
                return
              }
              case "F.Success":
              case "F.Failure": {
                const { id } = message
                const deferred = inflights[id]
                if (deferred) {
                  delete inflights[id]
                  switch (message._tag) {
                    case "F.Success": {
                      const { _tag, value } = message.success as never
                      yield* debug("Call.Succeeded", { id, _tag, value })
                      yield* Deferred.succeed(deferred, value)
                      return
                    }
                    case "F.Failure": {
                      const { _tag, value } = message.failure as never
                      yield* debug("Call.Failed", { id, _tag, value })
                      yield* Deferred.fail(deferred, value)
                      return
                    }
                  }
                }
                return
              }
              case "Disconnect": {
                yield* debug("Disconnected")
                return
              }
            }
          }),
        ).pipe(
          Effect.ensuring(
            Effect.all(
              [
                debug("Client.Closed", { unresolved: Record.keys(inflights).length }),
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
          const queue = yield* PubSub.subscribe(pubsub)
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

        yield* Deferred.await(audition)

        const encodingServices = yield* Effect.context<_["F"]["Payload"]["EncodingServices"]>()

        const f: F<Self, D> = (_tag) =>
          Effect.fnUntraced(
            function* (value) {
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
              const inflight = yield* Deferred.make<_["F"]["Success"]["Type"], FError<D>>()
              inflights[id] = inflight
              yield* send({
                _tag: "F.Payload",
                id,
                payload: { _tag, value } as never,
              })
              return yield* Effect.raceFirst(
                Deferred.await(inflight),
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
            },
            span("f"),
            Effect.scoped,
            Effect.provide(encodingServices),
          )

        return { events, f, end }
      }).pipe(span("acquire", { attributes: { client: client.key } }), Effect.annotateLogs("client", client.key)),
    })

    return rcr
  }).pipe(Layer.effect(client))

export const layerSocket = <Self, Id extends string, D extends ProtocolDefinition>({
  client,
  url,
  protocols,
  replay,
}: {
  readonly client: Client<Self, Id, D>
  readonly url?: string | undefined
  readonly protocols?: string | Array<string> | undefined
  readonly replay?: ReplayConfig | undefined
}): Layer.Layer<
  Self,
  never,
  | Socket.WebSocketConstructor
  | Protocol<D>["Actor"]["DecodingServices"]
  | Protocol<D>["F"]["Payload"]["EncodingServices"]
> => {
  const { F, Actor } = client.protocol
  const encodeFPayload = encodeJsonString(F.Payload)
  const decodeActor = decodeJsonString(Actor)

  return make<Self, Id, D, Socket.WebSocketConstructor>(
    client,
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
                    yield* debug("Socket.Disconnected")
                    return yield* publish({ _tag: "Disconnect" })
                  }
                  yield* debug(`SocketErrored.${reason._tag}`, { cause })
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

export const layerWorker = <Self, Id extends string, D extends ProtocolDefinition, T extends Protocol<D>>({
  client,
  replay,
}: {
  readonly client: Client<Self, Id, D>
  readonly replay?: ReplayConfig | undefined
}): Layer.Layer<
  Self,
  never,
  Worker.WorkerPlatform | Worker.Spawner | T["Actor"]["DecodingServices"] | T["F"]["Payload"]["EncodingServices"]
> =>
  make<Self, Id, D, Worker.WorkerPlatform | Worker.Spawner>(
    client,
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
