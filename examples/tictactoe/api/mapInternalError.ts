import { Effect } from "effect"
import { logCause } from "liminal/util/logCause"

export const mapInternalError = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.tapCause(effect, logCause).pipe(Effect.orDie)
