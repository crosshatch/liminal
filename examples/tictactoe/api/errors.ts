import { Schema as S } from "effect"

export class OutOfTurnError extends S.TaggedErrorClass<OutOfTurnError>()("OutOfTurnError", {}) {}

export class SlotTakenError extends S.TaggedErrorClass<SlotTakenError>()("SlotTakenError", {}) {}
