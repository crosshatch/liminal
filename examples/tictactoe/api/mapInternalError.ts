import { Effect, pipe } from "effect"

// TODO
export const mapInternalError = <A, E, R>(x: Effect.Effect<A, E, R>) =>
  pipe(x, Effect.tapError(Effect.logError), Effect.catchTags({}), Effect.orDie)
