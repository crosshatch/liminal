import { runtime } from "./runtime"
import { GameState } from "./State"

export const stateAtom = runtime.atom(GameState.stream)
