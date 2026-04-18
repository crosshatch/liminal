import { Cause, Effect, Schema as S, flow } from "effect"

const formatReason = <E>(reason: Cause.Reason<E>): unknown => {
  const value = Cause.isFailReason(reason) ? reason.error : Cause.isDieReason(reason) ? reason.defect : reason
  return S.isSchemaError(value) ? value.toString() : value
}

export const logCause = <E>(cause: Cause.Cause<E>) => Effect.forEach(cause.reasons, flow(formatReason, Effect.logError))
