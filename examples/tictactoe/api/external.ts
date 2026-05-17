import { Schema as S } from "effect"

import { Coordinates } from "./domain.ts"
import { OutOfTurnError, SlotTakenError } from "./errors.ts"

export const Move = {
  payload: S.Struct({
    position: Coordinates,
  }),
  failure: S.Union([OutOfTurnError, SlotTakenError]),
  success: S.Void,
}
