import { type Effect, Schema as S } from "effect"

import type { Fields, FieldsRecord } from "./_types.ts"

export type Reducers<Accumulator extends Fields, EventDefinitions extends FieldsRecord> = {
  [K in keyof EventDefinitions]: Reducer<S.Struct<EventDefinitions[K]>["Type"], Accumulator, any, any>
}

export type Reducer<T, Accumulator extends Fields, E, R> = (
  event: T,
  accumulator: S.Struct<Accumulator>["Type"],
) => Effect.Effect<void, E, R>
