import { Effect, Schema as S, Tracer } from "effect"

export const TraceEnvelope = S.Struct({
  traceId: S.String,
  spanId: S.String,
  sampled: S.Boolean,
})

export const TraceSession = S.Struct({
  sessionId: S.String.check(S.isUUID()),
  trace: TraceEnvelope,
})

export const toTrace = S.decodeSync(S.toType(TraceEnvelope))

export const parent = Effect.currentParentSpan.pipe(Effect.catchTag("NoSuchElementError", () => Effect.undefined))

export const current = Effect.currentSpan.pipe(Effect.catchTag("NoSuchElementError", () => Effect.undefined))

export const toLink = (
  envelope: typeof TraceEnvelope.Type,
  attributes: Record<string, unknown> = {},
): Tracer.SpanLink => ({
  span: Tracer.externalSpan(envelope),
  attributes,
})
