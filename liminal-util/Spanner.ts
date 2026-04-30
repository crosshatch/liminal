import { Effect, Tracer } from "effect"

export const make =
  (url: string) =>
  (operation: string, options?: Tracer.SpanOptions | undefined) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.withSpan(effect, operation, {
      ...options,
      attributes: {
        "code.filepath": url,
        ...options?.attributes,
      },
    })
