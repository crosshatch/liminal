import { Schema as S, Effect } from "effect"

import type { ProtocolDefinition } from "./Protocol.ts"

export type Send<ActorSelf, D extends ProtocolDefinition> = <K extends keyof D["events"]>(
  tag: K,
  payload: S.Struct<D["events"][K]>["Type"],
) => Effect.Effect<void, S.SchemaError, ActorSelf | ReturnType<typeof S.TaggedUnion<D["events"]>>["EncodingServices"]>
