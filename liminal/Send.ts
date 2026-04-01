import { Schema as S, ParseResult, Effect } from "effect"

import type { FieldsRecord } from "./_types.ts"

export type Send<ActorSelf, EventDefinitions extends FieldsRecord> = <K extends keyof EventDefinitions>(
  tag: K,
  payload: S.Struct<EventDefinitions[K]>["Type"],
) => Effect.Effect<void, ParseResult.ParseError, ActorSelf>
