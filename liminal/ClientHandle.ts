import { Schema as S, Effect } from "effect"

import type { Send } from "./Send.ts"

const TypeId = "~liminal/ClientHandle" as const

export interface ClientHandle<
  ActorSelf,
  AttachmentFields extends S.Struct.Fields,
  EventDefinitions extends Record<string, S.Struct.Fields>,
> {
  readonly [TypeId]: typeof TypeId

  readonly send: Send<ActorSelf, EventDefinitions>

  readonly attachments: Effect.Effect<S.Struct<AttachmentFields>["Type"]>

  readonly save: (
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<void, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>

  readonly disconnect: Effect.Effect<void, never, ActorSelf>
}

export const make = <
  ActorSelf,
  AttachmentFields extends S.Struct.Fields,
  EventDefinitions extends Record<string, S.Struct.Fields>,
>({
  send,
  attachments,
  save,
  disconnect,
}: {
  readonly send: Send<ActorSelf, EventDefinitions>

  readonly attachments: Effect.Effect<S.Struct<AttachmentFields>["Type"]>

  readonly save: (
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<void, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>

  readonly disconnect: Effect.Effect<void, never, ActorSelf>
}): ClientHandle<ActorSelf, AttachmentFields, EventDefinitions> => ({
  [TypeId]: TypeId,
  send,
  attachments,
  save,
  disconnect,
})
