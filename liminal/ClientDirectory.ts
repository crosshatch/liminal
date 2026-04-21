import { Schema as S, Effect, Cause, Ref } from "effect"

import type { TopFromString } from "./_util/schema.ts"
import type { Actor } from "./Actor.ts"
import type { ActorTransport } from "./ActorTransport.ts"
import type { ProtocolDefinition, Disconnect, Protocol } from "./Protocol.ts"

import * as Diagnostic from "./_util/Diagnostic.ts"
import { phantom } from "./_util/phantom.ts"
import * as ClientHandle from "./ClientHandle.ts"

const { span } = Diagnostic.module("ClientDirectory")

export interface ClientDirectory<
  Raw,
  ActorSelf,
  AttachmentFields extends S.Struct.Fields,
  D extends ProtocolDefinition,
> {
  readonly "": {
    readonly Handle: ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>
  }

  readonly handles: ReadonlySet<this[""]["Handle"]>

  readonly register: (
    raw: Raw,
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<this[""]["Handle"], S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>

  readonly get: (raw: Raw) => Effect.Effect<this[""]["Handle"], Cause.NoSuchElementError>

  readonly unregister: (raw: Raw) => Effect.Effect<void>
}

export interface HandleEncoders<T, AttachmentFields extends S.Struct.Fields, D extends ProtocolDefinition> {
  attachments: (
    value: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<T, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>
  event: (
    value: Protocol<D>["Event"]["Type"],
  ) => Effect.Effect<T, S.SchemaError, Protocol<D>["Event"]["EncodingServices"]>
  disconnect: Effect.Effect<T, S.SchemaError, (typeof Disconnect)["EncodingServices"]>
}

export const make = <
  Raw,
  ActorSelf,
  ActorId extends string,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
>(
  _actor: Actor<ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D>,
  { send, close, snapshot }: ActorTransport<Raw, AttachmentFields, D>,
): ClientDirectory<Raw, ActorSelf, AttachmentFields, D> => {
  type Handle = ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>

  const raws = new Map<Raw, Handle>()
  const handles = new Set<Handle>()

  const get = (raw: Raw) => Effect.fromNullishOr(raws.get(raw))

  const register = Effect.fnUntraced(function* (raw: Raw, attachments: S.Struct<AttachmentFields>["Type"]) {
    yield* snapshot(raw, attachments)
    const attachmentsRef = yield* Ref.make(attachments)
    const handle: Handle = ClientHandle.make({
      attachments: Ref.get(attachmentsRef),
      save: Effect.fnUntraced(function* (attachments) {
        yield* Ref.set(attachmentsRef, attachments)
        yield* snapshot(raw, attachments)
      }),
      send: (_tag, payload) =>
        send(raw, {
          _tag: "Event",
          event: { _tag, ...payload } as never,
        }),
      disconnect: close(raw).pipe(
        Effect.andThen(() =>
          Effect.sync(() => {
            raws.delete(raw)
            handles.delete(handle)
          }),
        ),
      ),
    })
    raws.set(raw, handle)
    handles.add(handle)
    return handle
  }, span("register"))

  const unregister = (raw: Raw) =>
    Effect.sync(() => {
      const handle = raws.get(raw)
      if (handle) {
        raws.delete(raw)
        handles.delete(handle)
      }
    }).pipe(span("unregister"))

  return { ...phantom, handles, register, get, unregister }
}
