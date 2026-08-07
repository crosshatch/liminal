import { Schema as S } from "effect"

export class OutOfTurnError extends S.TaggedError<OutOfTurnError>()("OutOfTurnError", {}) {}

export class SlotTakenError extends S.TaggedError<SlotTakenError>()("SlotTakenError", {}) {}
