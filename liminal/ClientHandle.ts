import { Schema as S, Effect } from "effect"

import type { ProtocolDefinition } from "./Protocol.ts"

export type Send<D extends ProtocolDefinition, RIn> = <K extends keyof D["events"]>(
  tag: K,
  payload: S.Struct<D["events"][K]>["Type"],
) => Effect.Effect<void, S.SchemaError, RIn | ReturnType<typeof S.TaggedUnion<D["events"]>>["EncodingServices"]>

export interface Sender<D extends ProtocolDefinition, R> {
  readonly send: Send<D, R>

  readonly disconnect: Effect.Effect<void, never, R>
}

export interface ClientHandle<
  ActorSelf,
  AttachmentFields extends S.Struct.Fields,
  D extends ProtocolDefinition,
> extends Sender<D, ActorSelf> {
  readonly attachments: Effect.Effect<S.Struct<AttachmentFields>["Type"]>

  readonly save: (
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<void, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>
}
