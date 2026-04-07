import { Schema as S, Effect, ParseResult } from "effect"

import type { Fields, FieldsRecord } from "./_types.ts"
import type { Send } from "./Send.ts"

const TypeId = "~liminal/ClientHandle" as const

export interface ClientHandle<ActorSelf, AttachmentFields extends Fields, EventDefinitions extends FieldsRecord> {
  readonly [TypeId]: typeof TypeId

  readonly send: Send<ActorSelf, EventDefinitions>

  readonly attachments: Effect.Effect<S.Struct<AttachmentFields>["Type"]>

  readonly save: (attachments: S.Struct<AttachmentFields>["Type"]) => Effect.Effect<void, ParseResult.ParseError>

  readonly disconnect: Effect.Effect<void, never, ActorSelf>
}

export const make = <ActorSelf, AttachmentFields extends Fields, EventDefinitions extends FieldsRecord>({
  send,
  attachments,
  save,
  disconnect,
}: {
  readonly send: Send<ActorSelf, EventDefinitions>

  readonly attachments: Effect.Effect<S.Struct<AttachmentFields>["Type"]>

  readonly save: (attachments: S.Struct<AttachmentFields>["Type"]) => Effect.Effect<void, ParseResult.ParseError>

  readonly disconnect: Effect.Effect<void, never, ActorSelf>
}): ClientHandle<ActorSelf, AttachmentFields, EventDefinitions> => ({
  [TypeId]: TypeId,
  send,
  attachments,
  save,
  disconnect,
})
