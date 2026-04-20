import { Schema as S, Effect, Ref, Cause } from "effect"
import { type Actor, ClientHandle, type Protocol } from "liminal"
import * as Diagnostic from "liminal/_util/Diagnostic"
import { phantom } from "liminal/_util/phantom"

const { span } = Diagnostic.module("cloudflare.ClientDirectory")

export interface ClientDirectory<
  ActorSelf,
  AttachmentFields extends S.Struct.Fields,
  D extends Protocol.ProtocolDefinition,
> {
  readonly "": {
    readonly Handle: ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>
  }

  readonly handles: ReadonlySet<this[""]["Handle"]>

  readonly register: (
    socket: WebSocket,
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<this[""]["Handle"], S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>

  readonly get: (socket: WebSocket) => Effect.Effect<this[""]["Handle"], Cause.NoSuchElementError, never>

  readonly unregister: (socket: WebSocket) => Effect.Effect<void>
}

export const make = <
  ActorSelf,
  ActorId extends string,
  NameA,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends Protocol.ProtocolDefinition,
>(
  actor: Actor.Actor<ActorSelf, ActorId, NameA, AttachmentFields, ClientSelf, ClientId, D>,
): ClientDirectory<ActorSelf, AttachmentFields, D> => {
  const {
    definition: {
      client: { protocol },
    },
    protocol: { Attachments },
  } = actor

  type Handle = ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>

  const sockets = new Map<WebSocket, Handle>()
  const handles = new Set<Handle>()

  const get = (socket: WebSocket) => Effect.fromNullishOr(sockets.get(socket))

  const encodeAttachments = S.encodeEffect(S.fromJsonString(S.toCodecJson(Attachments)))

  const register = Effect.fnUntraced(function* (
    socket: WebSocket,
    attachments: S.Struct<AttachmentFields>["Type"],
  ): Effect.fn.Return<Handle, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]> {
    const encoded = yield* encodeAttachments(attachments)
    socket.serializeAttachment(encoded)
    const attachmentsRef = yield* Ref.make(attachments)
    const handle = ClientHandle.make<ActorSelf, AttachmentFields, D>({
      attachments: Ref.get(attachmentsRef),
      save: Effect.fnUntraced(function* (value) {
        yield* Ref.set(attachmentsRef, value)
        socket.serializeAttachment(yield* encodeAttachments(value))
      }),
      send: (_tag, payload) => {
        return S.encodeEffect(S.fromJsonString(S.toCodecJson(protocol.Event)))({
          _tag: "Event",
          event: { _tag, ...payload } as never,
        }).pipe(Effect.andThen((v) => Effect.sync(() => socket.send(v))))
      },
      disconnect: Effect.sync(() => {
        socket.close(1000)
        sockets.delete(socket)
        handles.delete(handle)
      }),
    })
    sockets.set(socket, handle)
    handles.add(handle)
    return handle
  }, span("register"))

  const unregister = (socket: WebSocket) =>
    Effect.sync(() => {
      const handle = sockets.get(socket)
      if (handle) {
        sockets.delete(socket)
        handles.delete(handle)
      }
    }).pipe(span("unregister"))

  return {
    ...phantom,
    handles,
    register,
    get,
    unregister,
  }
}
