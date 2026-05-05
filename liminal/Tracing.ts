import { Effect, Schema as S, Tracer } from "effect"

export const TraceEnvelope = S.Struct({
  traceId: S.String,
  spanId: S.String,
  sampled: S.Boolean,
})

export const toTraceEnvelope = ({ traceId, spanId, sampled }: typeof TraceEnvelope.Type) => ({
  traceId,
  spanId,
  sampled,
})

export const SessionId = S.String.check(S.isUUID()).pipe(S.brand("SessionId"))

export const Session = S.Struct({
  id: SessionId,
  trace: TraceEnvelope,
})

export const parent = Effect.currentParentSpan.pipe(Effect.catchTag("NoSuchElementError", () => Effect.undefined))

export const current = Effect.currentSpan.pipe(Effect.catchTag("NoSuchElementError", () => Effect.undefined))

export const currentTrace = current.pipe(Effect.map((span) => (span ? toTraceEnvelope(span) : undefined)))

export const sessionAttributes = ({ id }: typeof Session.Type) => ({ "liminal.session.id": id })

export const sessionLink = (session: typeof Session.Type, attributes: Record<string, unknown> = {}) => ({
  span: Tracer.externalSpan(session.trace),
  attributes: {
    "liminal.link": "session",
    ...sessionAttributes(session),
    ...attributes,
  },
})
