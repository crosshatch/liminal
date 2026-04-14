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

import type { FieldsRecord } from "./_types.ts"
import type { MethodDefinition } from "./Method.ts"

import * as Diagnostic from "./_util/Diagnostic.ts"
import { type ClientError, AuditionError, ConnectionError, type FError, UnresolvedError } from "./errors.ts"
import { type F } from "./F.ts"
import * as Protocol from "./Protocol.ts"

const { debug, span } = Diagnostic.module("Client")

export const TypeId = "~liminal/Client" as const

export interface ClientDefinition<
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
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
  EventDefinitions extends FieldsRecord,
> {
  readonly events: Stream.Stream<FieldsRecord.TaggedMember.Type<EventDefinitions>, ClientError>

  readonly f: F<ClientSelf, MethodDefinitions>

  readonly end: Effect.Effect<void>
}

export type Service<
  ClientSelf,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> = RcRef.RcRef<Session<ClientSelf, MethodDefinitions, EventDefinitions>, ClientError>

export interface Spec<
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> {
  Call: {
    Payload: Protocol.Call.Payload.Type<MethodDefinitions>
    Success: Protocol.Call.Success.Type<MethodDefinitions>
    Failure: Protocol.Call.Failure.Type<MethodDefinitions>
  }
  Event: FieldsRecord.TaggedMember.Type<EventDefinitions>
  Actor: Protocol.Actor.Type<MethodDefinitions, EventDefinitions>
}

export interface ClientSchema<
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> {
  readonly call: {
    readonly payload: S.Codec<
      Protocol.Call.Payload.Type<MethodDefinitions>,
      Protocol.Call.Payload.Encoded<MethodDefinitions>
    >

    readonly success: S.Codec<
      Protocol.Call.Success.Type<MethodDefinitions>,
      Protocol.Call.Success.Encoded<MethodDefinitions>
    >

    readonly failure: S.Codec<
      Protocol.Call.Failure.Type<MethodDefinitions>,
      Protocol.Call.Failure.Encoded<MethodDefinitions>
    >
  }

  readonly event: S.Codec<Protocol.Event.Type<EventDefinitions>, Protocol.Event.Encoded<EventDefinitions>>

  readonly actor: S.Codec<
    Protocol.Actor.Type<MethodDefinitions, EventDefinitions>,
    Protocol.Actor.Encoded<MethodDefinitions, EventDefinitions>
  >
}

export interface Client<
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> extends Context.Service<ClientSelf, Service<ClientSelf, MethodDefinitions, EventDefinitions>> {
  new (_: never): Context.ServiceClass.Shape<ClientId, Service<ClientSelf, MethodDefinitions, EventDefinitions>>

  readonly [TypeId]: typeof TypeId

  readonly definition: ClientDefinition<MethodDefinitions, EventDefinitions>

  readonly schema: ClientSchema<MethodDefinitions, EventDefinitions>

  readonly events: Stream.Stream<FieldsRecord.TaggedMember.Type<EventDefinitions>, ClientError, ClientSelf>

  readonly f: F<ClientSelf, MethodDefinitions>

  readonly invalidate: Effect.Effect<void, never, ClientSelf>
}

export const Service =
  <ClientSelf>() =>
  <
    ClientId extends string,
    MethodDefinitions extends Record<string, MethodDefinition.Any>,
    EventDefinitions extends FieldsRecord,
  >(
    id: ClientId,
    definition: ClientDefinition<MethodDefinitions, EventDefinitions>,
  ): Client<ClientSelf, ClientId, MethodDefinitions, EventDefinitions> => {
    const tag = Context.Service<ClientSelf, Service<ClientSelf, MethodDefinitions, EventDefinitions>>()(id)

    const call: ClientSchema<MethodDefinitions, EventDefinitions>["call"] = {
      payload: S.TaggedStruct("Call.Payload", {
        id: S.Int,
        payload: S.Union(
          Record.toEntries(definition.methods).map(
            // TODO: remove never once `payload` / `S.Struct.Fields` typed without requirements
            ([_tag, { payload }]) => S.TaggedStruct(_tag, { value: S.Struct(payload) }) as never,
          ),
        ),
      }),
      success: S.TaggedStruct("Call.Success", {
        id: S.Int,
        value: S.Union(
          Record.toEntries(definition.methods).map(([_tag, { success: value }]) => S.TaggedStruct(_tag, { value })),
        ),
      }),
      failure: S.TaggedStruct("Call.Failure", {
        id: S.Int,
        cause: S.Union(
          Record.toEntries(definition.methods).map(([_tag, { failure: value }]) => S.TaggedStruct(_tag, { value })),
        ),
      }),
    }

    const event: S.Codec<
      Protocol.Event.Type<EventDefinitions>,
      Protocol.Event.Encoded<EventDefinitions>
    > = S.TaggedStruct("Event", {
      // TODO: revisit as never
      event: S.Union(Object.entries(definition.events).map(([_tag, fields]) => S.TaggedStruct(_tag, fields) as never)),
    })

    const actor: S.Union<
      [
        typeof call.success,
        typeof call.failure,
        typeof event,
        typeof Protocol.Audition.Success,
        typeof Protocol.Audition.Failure,
        typeof Protocol.Disconnect,
      ]
    > = S.Union([
      call.success,
      call.failure,
      event,
      Protocol.Audition.Success,
      Protocol.Audition.Failure,
      Protocol.Disconnect,
    ])

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
      schema: { call, event, actor },
      events,
      f,
      invalidate,
    })
  }

export interface Transport<
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> {
  readonly listen: (
    publish: (
      message: Protocol.Actor.Type<MethodDefinitions, EventDefinitions> | typeof Protocol.TransportFailure.Type,
    ) => Effect.Effect<void, ClientError>,
  ) => Effect.Effect<void, ClientError, Scope.Scope>

  readonly send: (v: Protocol.Call.Payload.Type<MethodDefinitions>) => Effect.Effect<void, ConnectionError, never>
}

const make = <
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
  R,
>(
  client: Client<ClientSelf, ClientId, MethodDefinitions, EventDefinitions>,
  build: Effect.Effect<Transport<MethodDefinitions, EventDefinitions>, ClientError, R | Scope.Scope>,
  replay?: ReplayConfig | undefined,
) =>
  Effect.gen(function* () {
    type _ = Spec<MethodDefinitions, EventDefinitions>

    const rcr: RcRef.RcRef<Session<ClientSelf, MethodDefinitions, EventDefinitions>, ClientError> = yield* RcRef.make({
      acquire: Effect.gen(function* () {
        yield* debug("AcquisitionStarted")

        const { listen, send } = yield* build

        const audition = yield* Deferred.make<void>()

        const inflights: Record<string, Deferred.Deferred<_["Call"]["Success"], FError<MethodDefinitions>>> = {}
        let callId = 0
        let takeCount = 0
        const pubsub = yield* PubSub.unbounded<EventTake<_["Event"], ClientError>>()

        const replayState = yield* Ref.make<{
          readonly startupOpen: boolean
          readonly buffer: ReadonlyArray<EventTake<_["Event"], ClientError>>
        }>({
          startupOpen: true,
          buffer: [],
        })

        const publishTake = (take: Take.Take<_["Event"], ClientError>, replayable?: boolean | undefined) =>
          Effect.gen(function* () {
            const eventTake: EventTake<_["Event"], ClientError> = {
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
                yield* debug("AuditionSucceeded")
                yield* Deferred.succeed(audition, void 0)
                return
              }
              case "Event": {
                const { event } = message
                yield* debug("EventEmitted", { event })
                yield* publishTake([event], true)
                return
              }
              case "Call.Success":
              case "Call.Failure": {
                const { id } = message
                const deferred = inflights[id]
                if (deferred) {
                  delete inflights[id]
                  switch (message._tag) {
                    case "Call.Success": {
                      const { _tag, value } = message.value
                      yield* debug("CallSucceeded", { id, _tag, value })
                      yield* Deferred.succeed(deferred, value)
                      return
                    }
                    case "Call.Failure": {
                      const { _tag, value: cause } = message.cause
                      yield* debug("CallFailed", { id, _tag, cause })
                      yield* Deferred.fail(deferred, { cause })
                      return
                    }
                  }
                }
                return
              }
              case "Audition.Failure": {
                const { actual, expected } = message
                yield* debug("AuditionFailed", { expected })
                return yield* new AuditionError({ value: { actual, expected } })
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
              const inflight = yield* Deferred.make<_["Call"]["Success"], FError<MethodDefinitions>>()
              inflights[id] = inflight
              yield* send({
                _tag: "Call.Payload",
                id,
                payload: { _tag, value },
              })
              return yield* Effect.raceFirst(
                Deferred.await(inflight),
                Fiber.join(fiber).pipe(Effect.andThen(() => new UnresolvedError().asEffect())),
              )
            },
            span("f"),
            Effect.scoped,
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
  EventDefinitions extends FieldsRecord,
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
}): Layer.Layer<ClientSelf, never, Socket.WebSocketConstructor> =>
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
                S.decodeUnknownEffect(S.fromJsonString(client.schema.actor)),
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
                          return yield* S.decodeUnknownEffect(S.fromJsonString(Protocol.Audition.Failure))(
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
            const message = yield* S.encodeEffect(S.fromJsonString(client.schema.call.payload))(v).pipe(
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
  EventDefinitions extends FieldsRecord,
>({
  client,
  replay,
}: {
  readonly client: Client<ClientSelf, ClientId, MethodDefinitions, EventDefinitions>
  readonly replay?: ReplayConfig | undefined
}): Layer.Layer<ClientSelf, never, Worker.WorkerPlatform | Worker.Spawner> =>
  make<ClientSelf, ClientId, MethodDefinitions, EventDefinitions, Worker.WorkerPlatform | Worker.Spawner>(
    client,
    Effect.gen(function* () {
      const platform = yield* Worker.WorkerPlatform
      const backing = yield* platform
        .spawn<
          Protocol.Actor.Type<MethodDefinitions, EventDefinitions>,
          Protocol.Call.Payload.Type<MethodDefinitions> | string
        >(0)
        .pipe(Effect.catchTag("WorkerError", (cause) => new ConnectionError({ cause }).asEffect()))

      const send = (message: Protocol.Call.Payload.Type<MethodDefinitions>) =>
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
                if (message._tag === "Disconnect" || message._tag === "Audition.Failure") {
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
