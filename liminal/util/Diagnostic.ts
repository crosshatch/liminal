import { Effect, Tracer } from "effect"

export const module = (module: string) => ({
  debug: (event: string, annotations?: Record<string, unknown>) =>
    Effect.logDebug(event).pipe(
      Effect.annotateLogs({
        package: "liminal",
        module,
        ...annotations,
      }),
    ),
  span:
    (operation: string, options?: Tracer.SpanOptions | undefined) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.withSpan(effect, `liminal.${module}.${operation}`, options),
})
