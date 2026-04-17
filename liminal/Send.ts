import { Schema as S, Effect } from "effect"

export type Send<ActorSelf, EventDefinitions extends Record<string, S.Struct.Fields>> = <
  K extends keyof EventDefinitions,
>(
  tag: K,
  payload: S.Struct<EventDefinitions[K]>["Type"],
) => Effect.Effect<
  void,
  S.SchemaError,
  ActorSelf | ReturnType<typeof S.TaggedUnion<EventDefinitions>>["EncodingServices"]
>
