import { Schema as S, Effect } from "effect"

import type { ProtocolDefinition } from "./Protocol.ts"
import type { Send } from "./Send.ts"

const TypeId = "~liminal/ClientHandle" as const

export interface ClientHandle<ActorSelf, AttachmentFields extends S.Struct.Fields, D extends ProtocolDefinition> {
  readonly [TypeId]: typeof TypeId

  readonly send: Send<ActorSelf, D>

  readonly attachments: Effect.Effect<S.Struct<AttachmentFields>["Type"]>

  readonly save: (
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<void, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>

  readonly disconnect: Effect.Effect<void, never, ActorSelf>
}

export const make = <ActorSelf, AttachmentFields extends S.Struct.Fields, D extends ProtocolDefinition>({
  send,
  attachments,
  save,
  disconnect,
}: {
  readonly send: Send<ActorSelf, D>

  readonly attachments: Effect.Effect<S.Struct<AttachmentFields>["Type"]>

  readonly save: (
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<void, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>

  readonly disconnect: Effect.Effect<void, never, ActorSelf>
}): ClientHandle<ActorSelf, AttachmentFields, D> => ({
  [TypeId]: TypeId,
  send,
  attachments,
  save,
  disconnect,
})
