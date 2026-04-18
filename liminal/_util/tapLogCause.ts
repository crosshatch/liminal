import { Cause, Effect, Schema as S, flow } from "effect"

const formatReason = <E>(reason: Cause.Reason<E>): unknown => {
  const value = Cause.isFailReason(reason) ? reason.error : Cause.isDieReason(reason) ? reason.defect : reason
  return S.isSchemaError(value) ? value.toString() : value
}

export const tapLogCause = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.tapCause(effect, (cause) => Effect.forEach(cause.reasons, flow(formatReason, Effect.logError)))
