import { Effect, type Cause } from "effect"

export const logCause = <E>(cause: Cause.Cause<E>) => Effect.logError(cause)
