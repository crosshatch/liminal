import type { Fields, FieldsRecord } from "liminal/_types"

import { Schema as S, Effect, Ref, Cause, ParseResult } from "effect"
import { Method, Actor, ClientHandle } from "liminal"

export interface ClientDirectory<ActorSelf, AttachmentFields extends Fields, EventDefinitions extends FieldsRecord> {
  readonly Handle: ClientHandle.ClientHandle<ActorSelf, AttachmentFields, EventDefinitions>

  readonly handles: ReadonlySet<this["Handle"]>

  readonly register: (
    socket: WebSocket,
    attachments: {
      readonly [K in keyof S.Struct.Type<AttachmentFields>]: S.Struct.Type<AttachmentFields>[K]
    },
  ) => Effect.Effect<this["Handle"], ParseResult.ParseError, never>

  readonly get: (socket: WebSocket) => Effect.Effect<this["Handle"], Cause.NoSuchElementException, never>

  readonly unregister: (socket: WebSocket) => Effect.Effect<void>

  readonly flush: Effect.Effect<void>
}

export const make = <
  ActorSelf,
  ActorId extends string,
  NameA,
  AttachmentFields extends Fields,
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
>(
  actor: Actor.Actor<
    ActorSelf,
    ActorId,
    NameA,
    AttachmentFields,
    ClientSelf,
    ClientId,
    MethodDefinitions,
    EventDefinitions
  >,
): ClientDirectory<ActorSelf, AttachmentFields, EventDefinitions> => {
  const {
    definition: {
      client: {
        schema: { event },
      },
    },
    schema,
  } = actor

  type Handle = ClientHandle.ClientHandle<ActorSelf, AttachmentFields, EventDefinitions>

  const sockets = new Map<WebSocket, Handle>()
  const handles = new Set<Handle>()
  const pendingDisconnects = new Set<WebSocket>()

  const get = (socket: WebSocket) => Effect.fromNullable(sockets.get(socket))

  const register = Effect.fnUntraced(function* (
    socket: WebSocket,
    attachments: S.Struct<AttachmentFields>["Type"],
  ): Effect.fn.Return<Handle, ParseResult.ParseError> {
    const encoded = yield* S.encode(schema.attachments)(attachments)
    socket.serializeAttachment(encoded)
    const attachmentsRef = yield* Ref.make(attachments)
    const handle = ClientHandle.make<ActorSelf, AttachmentFields, EventDefinitions>({
      attachments: Ref.get(attachmentsRef),
      save: Effect.fnUntraced(function* (value) {
        yield* Ref.set(attachmentsRef, value)
        socket.serializeAttachment(yield* S.encode(schema.attachments)(value))
      }),
      send: (_tag, payload) =>
        S.encode(S.parseJson(event))({
          _tag: "Event",
          event: { _tag, ...payload },
        }).pipe(Effect.andThen((v) => Effect.sync(() => socket.send(v)))),
      disconnect: Effect.sync(() => {
        pendingDisconnects.add(socket)
        sockets.delete(socket)
        handles.delete(handle)
      }),
    })
    sockets.set(socket, handle)
    handles.add(handle)
    return handle
  })

  const unregister = (socket: WebSocket) =>
    Effect.sync(() => {
      const handle = sockets.get(socket)
      if (handle) {
        sockets.delete(socket)
        handles.delete(handle)
      }
    })

  const flush = Effect.sync(() => {
    for (const ws of pendingDisconnects) {
      ws.close(1000)
    }
    pendingDisconnects.clear()
  })

  return {
    Handle: null!,
    handles,
    register,
    get,
    unregister,
    flush,
  }
}
