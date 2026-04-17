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
  identity,
} from "effect"
import { Socket } from "effect/unstable/socket"
import { Worker } from "effect/unstable/workers"

import type { MethodDefinition } from "./Method.ts"

import * as Diagnostic from "./_util/Diagnostic.ts"
import { type ClientError, AuditionError, ConnectionError, type FError, UnresolvedError } from "./errors.ts"
import { type F } from "./F.ts"
import * as Protocol from "./Protocol.ts"

const { debug, span } = Diagnostic.module("Client")

export const TypeId = "~liminal/Client" as const

export interface ClientDefinition<
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
> {
  readonly methods: MethodDefinitions

  readonly events: EventDefinitions
}

export interface ReplayConfig {
  readonly mode: "startup" | "all-subscribers"

  readonly limit?: number | undefined
}

interface EventTake<A, E> {
  readonly seq: number

  readonly take: Take.Take<A, E>
}

export interface Session<
  ClientSelf,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
> {
  readonly events: Stream.Stream<ReturnType<typeof S.TaggedUnion<EventDefinitions>>["Type"], ClientError>

  readonly f: F<ClientSelf, MethodDefinitions>

  readonly end: Effect.Effect<void>
}

export type Service<
  ClientSelf,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
> = RcRef.RcRef<Session<ClientSelf, MethodDefinitions, EventDefinitions>, ClientError>

export interface Client<
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
> extends Context.Service<ClientSelf, Service<ClientSelf, MethodDefinitions, EventDefinitions>> {
  new (_: never): Context.ServiceClass.Shape<ClientId, Service<ClientSelf, MethodDefinitions, EventDefinitions>>

  readonly [TypeId]: typeof TypeId

  readonly definition: ClientDefinition<MethodDefinitions, EventDefinitions>

  readonly schema: Protocol.ProtocolSchemas<MethodDefinitions, EventDefinitions>

  readonly events: Stream.Stream<ReturnType<typeof S.TaggedUnion<EventDefinitions>>["Type"], ClientError, ClientSelf>

  readonly f: F<ClientSelf, MethodDefinitions>

  readonly invalidate: Effect.Effect<void, never, ClientSelf>
}

export const Service =
  <ClientSelf>() =>
  <
    ClientId extends string,
    MethodDefinitions extends Record<string, MethodDefinition.Any>,
    EventDefinitions extends Record<string, S.Struct.Fields>,
  >(
    id: ClientId,
    definition: ClientDefinition<MethodDefinitions, EventDefinitions>,
  ): Client<ClientSelf, ClientId, MethodDefinitions, EventDefinitions> => {
    const tag = Context.Service<ClientSelf, Service<ClientSelf, MethodDefinitions, EventDefinitions>>()(id)

    const events = tag.asEffect().pipe(Effect.flatMap(RcRef.get), Effect.map(Struct.get("events")), Stream.unwrap)

    const f: F<ClientSelf, MethodDefinitions> = (_tag) =>
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
      schema: Protocol.ProtocolSchemas(definition.methods, definition.events),
      events,
      f,
      invalidate,
    })
  }

export interface Transport<
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
> {
  readonly listen: (
    publish: (
      message:
        | Protocol.ProtocolSchemas<MethodDefinitions, EventDefinitions>["actor"]["Type"]
        | typeof Protocol.TransportFailure.Type,
    ) => Effect.Effect<void, ClientError>,
  ) => Effect.Effect<
    void,
    ClientError,
    Scope.Scope | Protocol.ProtocolSchemas<MethodDefinitions, EventDefinitions>["actor"]["DecodingServices"]
  >

  readonly send: (
    message: Protocol.ProtocolSchemas<MethodDefinitions, EventDefinitions>["f"]["payload"]["Type"],
  ) => Effect.Effect<
    void,
    ConnectionError,
    Protocol.ProtocolSchemas<MethodDefinitions, EventDefinitions>["f"]["payload"]["EncodingServices"]
  >
}

const make = <
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
  R,
>(
  client: Client<ClientSelf, ClientId, MethodDefinitions, EventDefinitions>,
  build: Effect.Effect<Transport<MethodDefinitions, EventDefinitions>, ClientError, R | Scope.Scope>,
  replay?: ReplayConfig | undefined,
) =>
  Effect.gen(function* () {
    const rcr: RcRef.RcRef<Session<ClientSelf, MethodDefinitions, EventDefinitions>, ClientError> = yield* RcRef.make({
      acquire: Effect.gen(function* () {
        type _ = typeof client.schema
        type Event = ReturnType<typeof S.TaggedUnion<EventDefinitions>>["Type"]

        yield* debug("AcquisitionStarted")

        const { listen, send } = yield* build

        const audition = yield* Deferred.make<void>()

        const inflights: Record<string, Deferred.Deferred<_["f"]["success"]["Type"], FError<MethodDefinitions>>> = {}
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
              case "AuditionSuccess": {
                yield* debug("AuditionSucceeded")
                yield* Deferred.succeed(audition, void 0)
                return
              }
              case "Event": {
                const { event } = message
                yield* debug("EventEmitted", { event })
                yield* publishTake([event as never], true)
                return
              }
              case "FSuccess":
              case "FFailure": {
                const { id } = message
                const deferred = inflights[id]
                if (deferred) {
                  delete inflights[id]
                  switch (message._tag) {
                    case "FSuccess": {
                      const { _tag, value } = message.success as never
                      yield* debug("CallSucceeded", { id, _tag, value })
                      yield* Deferred.succeed(deferred, value)
                      return
                    }
                    case "FFailure": {
                      const { _tag, value } = message.failure as never
                      yield* debug("CallFailed", { id, _tag, value })
                      yield* Deferred.fail(deferred, value)
                      return
                    }
                  }
                }
                return
              }
              case "AuditionFailure": {
                const { client, routed } = message
                yield* debug("AuditionFailed", { client, routed })
                return yield* new AuditionError({ value: { client, routed } })
              }
              case "Disconnect": {
                yield* debug("Disconnected")
                return
              }
              case "TransportFailure": {
                const { cause } = message
                yield* debug("TransportFailed", { cause })
                return yield* new ConnectionError({ cause })
              }
            }
          }),
        ).pipe(
          Effect.ensuring(
            Effect.all(
              [
                debug("ClientClosed", { unresolved: Record.keys(inflights).length }),
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
        }).pipe(Stream.unwrap, Stream.interruptWhen(Fiber.join(fiber)))

        yield* Deferred.await(audition)

        const encodingServices = yield* Effect.context<_["f"]["payload"]["EncodingServices"]>()

        const f: F<ClientSelf, MethodDefinitions> = (_tag) =>
          Effect.fnUntraced(
            function* (value) {
              const exit = fiber.pollUnsafe()
              if (exit) {
                return yield* Exit.match(exit, {
                  onSuccess: () => new UnresolvedError(),
                  onFailure: flow(
                    Cause.findError,
                    Result.match({
                      onSuccess: identity,
                      onFailure: () => new UnresolvedError(),
                    }),
                  ),
                })
              }
              const id = callId++
              const inflight = yield* Deferred.make<_["f"]["success"]["Type"], FError<MethodDefinitions>>()
              inflights[id] = inflight
              yield* send({
                _tag: "FPayload",
                id,
                payload: { _tag, value } as never,
              })
              return yield* Effect.raceFirst(
                Deferred.await(inflight),
                Fiber.join(fiber).pipe(Effect.andThen(() => new UnresolvedError().asEffect())),
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

export const layerSocket = <
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
>({
  client,
  url,
  protocols,
  replay,
}: {
  readonly client: Client<ClientSelf, ClientId, MethodDefinitions, EventDefinitions>
  readonly url?: string | undefined
  readonly protocols?: string | Array<string> | undefined
  readonly replay?: ReplayConfig | undefined
}): Layer.Layer<
  ClientSelf,
  never,
  | Socket.WebSocketConstructor
  | Protocol.ProtocolSchemas<MethodDefinitions, EventDefinitions>["actor"]["DecodingServices"]
  | Protocol.ProtocolSchemas<MethodDefinitions, EventDefinitions>["f"]["payload"]["EncodingServices"]
> =>
  make<ClientSelf, ClientId, MethodDefinitions, EventDefinitions, Socket.WebSocketConstructor>(
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
                S.decodeUnknownEffect(S.fromJsonString(S.toCodecJson(client.schema.actor))),
                Effect.andThen(publish),
              ),
            )
            .pipe(
              Effect.catchTag(
                "SocketError",
                Effect.fnUntraced(function* (cause) {
                  const { reason } = cause
                  switch (reason._tag) {
                    case "SocketReadError":
                    case "SocketWriteError":
                    case "SocketOpenError": {
                      yield* debug(reason._tag, { cause })
                      return yield* publish({ _tag: "TransportFailure", cause })
                    }
                    case "SocketCloseError": {
                      const { code, closeReason } = reason
                      switch (code) {
                        case 1000: {
                          return yield* publish({ _tag: "Disconnect" })
                        }
                        case 4003: {
                          return yield* S.decodeUnknownEffect(S.fromJsonString(Protocol.AuditionFailure))(
                            closeReason,
                          ).pipe(Effect.andThen(publish))
                        }
                      }
                      yield* debug("SocketCloseError", { cause })
                      return yield* publish({ _tag: "TransportFailure", cause })
                    }
                  }
                }),
              ),
              Effect.catchTag("SchemaError", Effect.die),
            )
        }, span("listen")),
        send: Effect.fnUntraced(
          function* (v) {
            const write = yield* socket.writer
            const message = yield* S.encodeEffect(S.fromJsonString(S.toCodecJson(client.schema.f.payload)))(v).pipe(
              Effect.mapError((cause) => new ConnectionError({ cause })),
            )
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

export const layerWorker = <
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
>({
  client,
  replay,
}: {
  readonly client: Client<ClientSelf, ClientId, MethodDefinitions, EventDefinitions>
  readonly replay?: ReplayConfig | undefined
}): Layer.Layer<
  ClientSelf,
  never,
  | Worker.WorkerPlatform
  | Worker.Spawner
  | Protocol.ProtocolSchemas<MethodDefinitions, EventDefinitions>["actor"]["DecodingServices"]
  | Protocol.ProtocolSchemas<MethodDefinitions, EventDefinitions>["f"]["payload"]["EncodingServices"]
> =>
  make<ClientSelf, ClientId, MethodDefinitions, EventDefinitions, Worker.WorkerPlatform | Worker.Spawner>(
    client,
    Effect.gen(function* () {
      type T = typeof client.schema

      const platform = yield* Worker.WorkerPlatform
      const backing = yield* platform
        .spawn<T["actor"]["Type"], T["f"]["payload"]["Type"] | string>(0)
        .pipe(Effect.catchTag("WorkerError", (cause) => new ConnectionError({ cause }).asEffect()))

      const send = (message: T["f"]["payload"]["Type"]) =>
        backing.send(message).pipe(
          Effect.catchTag("WorkerError", (cause) => new ConnectionError({ cause }).asEffect()),
          span("send"),
        )

      return {
        listen: Effect.fnUntraced(function* (publish) {
          const stop = yield* Deferred.make<void>()
          yield* Effect.raceFirst(
            backing.run(
              Effect.fnUntraced(function* (message) {
                yield* publish(message)
                if (message._tag === "Disconnect" || message._tag === "AuditionFailure") {
                  yield* Deferred.succeed(stop, void 0)
                }
              }),
              { onSpawn: backing.send(client.key).pipe(Effect.orDie) },
            ),
            Deferred.await(stop),
          ).pipe(Effect.catchTag("WorkerError", (cause) => publish({ _tag: "TransportFailure", cause })))
        }, span("listen")),
        send,
      }
    }),
    replay,
  )
