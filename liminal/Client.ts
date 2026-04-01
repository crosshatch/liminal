import { Socket, Worker } from "@effect/platform"
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
  Ref,
  Scope,
  Stream,
  Take,
  Schema as S,
  Array,
  Struct,
  ExecutionStrategy,
  Exit,
} from "effect"

import type { FieldsRecord } from "./_types.ts"
import type { MethodDefinition } from "./Method.ts"

import { type ClientError, AuditionError, ConnectionError } from "./errors.ts"
import { type F, type FError, UnresolvedError } from "./F.ts"
import * as Protocol from "./Protocol.ts"

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

export interface TransportSession<
  ClientSelf,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> {
  readonly events: Stream.Stream<FieldsRecord.TaggedMember.Type<EventDefinitions>, ClientError>

  readonly f: F<ClientSelf, MethodDefinitions>
}

export type Service<
  ClientSelf,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> = RcRef.RcRef<TransportSession<ClientSelf, MethodDefinitions, EventDefinitions>, ClientError>

export interface Spec<
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> {
  Call: Protocol.CallMessage.Type<MethodDefinitions>
  Success: Protocol.SuccessMessage.Type<MethodDefinitions>
  Failure: Protocol.FailureMessage.Type<MethodDefinitions>
  Event: FieldsRecord.TaggedMember.Type<EventDefinitions>
  Actor: Protocol.ActorMessage.Type<MethodDefinitions, EventDefinitions>
}

export interface Client<
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> extends Context.Tag<ClientSelf, Service<ClientSelf, MethodDefinitions, EventDefinitions>> {
  new (_: never): Context.TagClassShape<ClientId, Service<ClientSelf, MethodDefinitions, EventDefinitions>>

  readonly [TypeId]: typeof TypeId

  readonly definition: ClientDefinition<MethodDefinitions, EventDefinitions>

  readonly schema: {
    readonly call: S.Schema<
      Protocol.CallMessage.Type<MethodDefinitions>,
      Protocol.CallMessage.Encoded<MethodDefinitions>
    >

    readonly success: S.Schema<
      Protocol.SuccessMessage.Type<MethodDefinitions>,
      Protocol.SuccessMessage.Encoded<MethodDefinitions>
    >

    readonly failure: S.Schema<
      Protocol.FailureMessage.Type<MethodDefinitions>,
      Protocol.FailureMessage.Encoded<MethodDefinitions>
    >

    readonly event: S.Schema<
      Protocol.EventMessage.Type<EventDefinitions>,
      Protocol.EventMessage.Encoded<EventDefinitions>
    >

    readonly actor: S.Schema<
      Protocol.ActorMessage.Type<MethodDefinitions, EventDefinitions>,
      Protocol.ActorMessage.Encoded<MethodDefinitions, EventDefinitions>
    >
  }

  readonly events: Stream.Stream<FieldsRecord.TaggedMember.Type<EventDefinitions>, ClientError, ClientSelf>

  readonly f: F<ClientSelf, MethodDefinitions>
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
    const clientTag = Context.Tag(id)<ClientSelf, Service<ClientSelf, MethodDefinitions, EventDefinitions>>()

    const call: S.Schema<
      Protocol.CallMessage.Type<MethodDefinitions>,
      Protocol.CallMessage.Encoded<MethodDefinitions>
    > = S.TaggedStruct("Call", {
      id: S.Int,
      payload: S.Union(
        ...Record.toEntries(definition.methods).map(([_tag, { payload }]) =>
          S.TaggedStruct(_tag, { value: S.Struct(payload) }),
        ),
      ),
    }) as never

    const success: S.Schema<
      Protocol.SuccessMessage.Type<MethodDefinitions>,
      Protocol.SuccessMessage.Encoded<MethodDefinitions>
    > = S.TaggedStruct("Success", {
      id: S.Int,
      value: S.Union(
        ...Record.toEntries(definition.methods).map(([_tag, { success: value }]) => S.TaggedStruct(_tag, { value })),
      ),
    }) as never

    const failure: S.Schema<
      Protocol.FailureMessage.Type<MethodDefinitions>,
      Protocol.FailureMessage.Encoded<MethodDefinitions>
    > = S.TaggedStruct("Failure", {
      id: S.Int,
      cause: S.Union(
        ...Record.toEntries(definition.methods).map(([_tag, { failure: value }]) => S.TaggedStruct(_tag, { value })),
      ),
    }) as never

    const event: S.Schema<
      Protocol.EventMessage.Type<EventDefinitions>,
      Protocol.EventMessage.Encoded<EventDefinitions>
    > = S.TaggedStruct("Event", {
      event: S.Union(...Object.entries(definition.events).map(([_tag, fields]) => S.TaggedStruct(_tag, fields))),
    }) as never

    const actor: S.Schema<
      Protocol.ActorMessage.Type<MethodDefinitions, EventDefinitions>,
      Protocol.ActorMessage.Encoded<MethodDefinitions, EventDefinitions>
    > = S.Union(
      success,
      failure,
      event,
      Protocol.AuditionSuccessMessage,
      Protocol.AuditionFailureMessage,
      Protocol.DisconnectMessage,
    )

    const events: Stream.Stream<
      FieldsRecord.TaggedMember.Type<EventDefinitions>,
      ClientError,
      ClientSelf
    > = clientTag.pipe(Effect.flatMap(RcRef.get), Effect.map(Struct.get("events")), Stream.unwrapScoped)

    const f: F<ClientSelf, MethodDefinitions> = (_tag) =>
      Effect.fnUntraced(function* (value) {
        const { f } = yield* clientTag.pipe(Effect.flatMap(RcRef.get))
        return yield* f(_tag)(value)
      }, Effect.scoped)

    return Object.assign(clientTag, {
      [TypeId]: TypeId,
      definition,
      schema: { call, success, failure, event, actor },
      events,
      f,
    })
  }

export interface Transport<
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> {
  readonly listen: (
    publish: (
      message:
        | Protocol.ActorMessage.Type<MethodDefinitions, EventDefinitions>
        | typeof Protocol.TransportFailureMessage.Type,
    ) => Effect.Effect<void, never>,
  ) => Effect.Effect<void, never, Scope.Scope>

  readonly send: (v: Protocol.CallMessage.Type<MethodDefinitions>) => Effect.Effect<void, ConnectionError, never>
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

    const rcr: RcRef.RcRef<
      TransportSession<ClientSelf, MethodDefinitions, EventDefinitions>,
      ClientError
    > = yield* RcRef.make({
      acquire: Effect.gen(function* () {
        const { listen, send } = yield* build

        const inflights: Record<string, Deferred.Deferred<_["Success"], FError<MethodDefinitions>>> = {}
        let callId = 0
        let takeCount = 0
        const pubsub = yield* PubSub.unbounded<EventTake<_["Event"], ClientError>>()
        const audition = yield* Deferred.make<void, ClientError>()
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
                return {
                  startupOpen: state.startupOpen,
                  buffer,
                }
              })
            }
            yield* PubSub.publish(pubsub, eventTake)
          })

        const events: Stream.Stream<_["Event"], ClientError> = Effect.gen(function* () {
          const queue = yield* PubSub.subscribe(pubsub)
          const live = (replayCount: number): Stream.Stream<_["Event"], ClientError> =>
            Stream.fromQueue(queue).pipe(
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
        }).pipe(Stream.unwrapScoped)

        const parentScope = yield* Scope.Scope
        const scope = yield* Scope.fork(parentScope, ExecutionStrategy.sequential)
        const publishFinalTake = (take: Take.Take<_["Event"], ClientError>) =>
          publishTake(take).pipe(Effect.andThen(Scope.close(scope, Exit.void)))

        yield* listen(
          Effect.fnUntraced(function* (message) {
            switch (message._tag) {
              case "AuditionSucceeded": {
                return yield* Deferred.succeed(audition, void 0)
              }
              case "Event": {
                const { event } = message
                return yield* publishTake(Take.of(event), true)
              }
              case "Success":
              case "Failure": {
                const { id } = message
                const deferred = inflights[id]
                if (deferred) {
                  delete inflights[id]
                  switch (message._tag) {
                    case "Success": {
                      yield* Deferred.succeed(deferred, message.value.value)
                      break
                    }
                    case "Failure": {
                      yield* Deferred.fail(deferred, message.cause.value)
                      break
                    }
                  }
                }
                return
              }
              case "AuditionFailure": {
                const { actual, expected } = message
                return yield* publishFinalTake(
                  Take.fail(
                    AuditionError.make({
                      value: { actual, expected },
                    }),
                  ),
                )
              }
              case "Disconnect":
              case "TransportFailure": {
                yield* Deferred.succeed(audition, void 0)
                switch (message._tag) {
                  case "Disconnect": {
                    return yield* publishFinalTake(Take.end)
                  }
                  case "TransportFailure": {
                    const { cause } = message
                    return yield* publishFinalTake(Take.fail(ConnectionError.make({ cause })))
                  }
                }
              }
            }
          }),
        ).pipe(
          Effect.ensuring(
            Effect.all(
              [
                PubSub.shutdown(pubsub),
                // TODO: last take error if present
                Effect.forEach(
                  Record.values(inflights),
                  (deferred) => Deferred.fail(deferred, UnresolvedError.make()),
                  { concurrency: "unbounded" },
                ),
                RcRef.invalidate(rcr),
              ],
              { concurrency: "unbounded" },
            ),
          ),
          Effect.forkScoped,
          Scope.extend(scope),
        )

        yield* Deferred.await(audition)

        const f: F<ClientSelf, MethodDefinitions> = (_tag) =>
          Effect.fnUntraced(function* (value) {
            const id = callId++
            const inflight = yield* Deferred.make<_["Success"], FError<MethodDefinitions>>()
            inflights[id] = inflight
            yield* send({
              _tag: "Call",
              id,
              payload: { _tag, value },
            })
            return yield* Deferred.await(inflight)
          }, Effect.scoped)

        return { events, f }
      }),
    })
    return rcr
  }).pipe(Layer.scoped(client))

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
  readonly url: string
  readonly protocols?: string | Array<string> | undefined
  readonly replay?: ReplayConfig | undefined
}): Layer.Layer<ClientSelf, never, Socket.WebSocketConstructor> =>
  make<ClientSelf, ClientId, MethodDefinitions, EventDefinitions, Socket.WebSocketConstructor>(
    client,
    Effect.gen(function* () {
      const socket = yield* Socket.makeWebSocket(url, {
        protocols: [
          "liminal",
          Encoding.encodeBase64Url(client.key),
          ...(protocols ? (Array.isArray(protocols) ? protocols : [protocols]) : []),
        ],
      })
      return {
        listen: Effect.fnUntraced(function* (publish) {
          yield* socket
            .runRaw(
              Effect.fnUntraced(function* (raw) {
                const message = yield* S.decodeUnknown(S.parseJson(client.schema.actor))(
                  raw instanceof Uint8Array ? new TextDecoder().decode(raw) : raw,
                ).pipe(
                  Effect.catchTag("ParseError", (cause) =>
                    Effect.succeed(Protocol.TransportFailureMessage.make({ _tag: "TransportFailure", cause })),
                  ),
                )
                yield* publish(message)
              }),
            )
            .pipe(
              Effect.catchTag(
                "SocketError",
                Effect.fnUntraced(function* (cause) {
                  switch (cause.reason) {
                    case "Read":
                    case "Write":
                    case "Open":
                    case "OpenTimeout": {
                      // TODO
                      console.log(cause)
                      return yield* publish({ _tag: "TransportFailure", cause })
                    }
                    case "Close": {
                      const { code, closeReason } = cause
                      switch (code) {
                        case 1000: {
                          return yield* publish({ _tag: "Disconnect" })
                        }
                        case 4003: {
                          const parsed = S.decodeUnknownOption(S.parseJson(Protocol.AuditionFailureMessage))(
                            closeReason,
                          )
                          if (parsed._tag === "None") {
                            return yield* publish({ _tag: "TransportFailure", cause })
                          }
                          const { actual, expected } = parsed.value
                          return yield* publish({
                            _tag: "AuditionFailure",
                            actual,
                            expected,
                          })
                        }
                      }
                      return yield* publish({ _tag: "TransportFailure", cause })
                    }
                  }
                }),
              ),
            )
        }),
        send: Effect.fnUntraced(function* (v) {
          const write = yield* socket.writer
          const message = yield* S.encode(S.parseJson(client.schema.call))(v).pipe(
            Effect.mapError((cause) => ConnectionError.make({ cause })),
          )
          yield* write(message).pipe(Effect.catchTag("SocketError", (cause) => ConnectionError.make({ cause })))
        }, Effect.scoped),
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
}): Layer.Layer<ClientSelf, never, Worker.PlatformWorker | Worker.Spawner> =>
  make<ClientSelf, ClientId, MethodDefinitions, EventDefinitions, Worker.PlatformWorker | Worker.Spawner>(
    client,
    Effect.gen(function* () {
      const manager = yield* Worker.makeManager
      const worker = yield* manager
        .spawn<
          Protocol.CallMessage.Type<MethodDefinitions> | string,
          Protocol.ActorMessage.Type<MethodDefinitions, EventDefinitions>,
          never
        >({})
        .pipe(Effect.catchTag("WorkerError", (cause) => ConnectionError.make({ cause })))

      const send = (message: Protocol.CallMessage.Type<MethodDefinitions>) =>
        worker.executeEffect(message).pipe(Effect.catchTag("WorkerError", (cause) => ConnectionError.make({ cause })))

      return {
        listen: Effect.fnUntraced(function* (publish) {
          yield* worker.execute(client.key).pipe(
            Stream.catchTag("WorkerError", (cause) =>
              Effect.gen(function* () {
                yield* publish({ _tag: "TransportFailure", cause })
                return Stream.empty
              }).pipe(Stream.unwrap),
            ),
            Stream.takeUntil((message) => message._tag === "Disconnect" || message._tag === "AuditionFailure"),
            Stream.runForEach(publish),
          )
        }),
        send,
      }
    }),
    replay,
  )
