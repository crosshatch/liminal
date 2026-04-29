import { Effect, Option, Schema as S, Tracer } from "effect"
import { OtlpExporter } from "effect/unstable/observability"

export const TraceEnvelope = S.Struct({
  traceId: S.String,
  spanId: S.String,
  sampled: S.Boolean,
})

export const TraceSession = S.Struct({
  sessionId: S.String.check(S.isUUID()),
  trace: TraceEnvelope,
})

export const toTrace = (span: typeof TraceEnvelope.Type): typeof TraceEnvelope.Type => ({
  traceId: span.traceId,
  spanId: span.spanId,
  sampled: span.sampled,
})

export const current: Effect.Effect<Option.Option<typeof TraceEnvelope.Type>> = Effect.currentSpan.pipe(
  Effect.map(toTrace),
  Effect.option,
)

export const toLink = (
  envelope: typeof TraceEnvelope.Type,
  attributes: Record<string, unknown> = {},
): Tracer.SpanLink => ({
  span: Tracer.externalSpan(envelope),
  attributes,
})

export const flush = Effect.serviceOption(OtlpExporter.Exporters).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.void,
      onSome: (exporters) => exporters.flush,
    }),
  ),
  Effect.ignore,
)
