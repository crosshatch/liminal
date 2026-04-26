import { Effect, Tracer } from "effect"

export const factory = (package_: string) => (module: string) => ({
  debug: (event: string, annotations?: Record<string, unknown>) =>
    Effect.logDebug(event).pipe(
      Effect.annotateLogs({
        package: package_,
        module,
        ...annotations,
      }),
    ),
  span:
    (operation: string, options?: Tracer.SpanOptions | undefined) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.withSpan(effect, `${package_}.${module}.${operation}`, options),
})
