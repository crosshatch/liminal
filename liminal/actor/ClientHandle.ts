import { Schema as S, Effect } from "effect"

import type { ProtocolDefinition } from "./Protocol.ts"

export interface Sender<ActorSelf, D extends ProtocolDefinition> {
  readonly send: <K extends keyof D["events"]>(
    tag: K,
    payload: S.Struct<D["events"][K]>["Type"],
  ) => Effect.Effect<void, S.SchemaError, ActorSelf | ReturnType<typeof S.TaggedUnion<D["events"]>>["EncodingServices"]>

  readonly disconnect: Effect.Effect<void, never, ActorSelf>
}

export interface ClientHandle<
  ActorSelf,
  AttachmentFields extends S.Struct.Fields,
  D extends ProtocolDefinition,
> extends Sender<ActorSelf, D> {
  readonly attachments: Effect.Effect<S.Struct<AttachmentFields>["Type"]>

  readonly save: (
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<void, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>
}
