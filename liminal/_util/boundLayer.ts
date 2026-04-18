import { References, Effect, Layer, Cause, flow } from "effect"

export const boundLayer = (boundary: string) =>
  Layer.provideMerge(
    Layer.effect(
      References.CurrentLogAnnotations,
      Effect.map(References.CurrentLogAnnotations.asEffect(), (existing) => ({
        ...existing,
        liminalBoundary: boundary,
      })),
    ).pipe(
      Layer.tapCause(flow(Cause.pretty, Effect.logError)),
      Layer.provideMerge(Layer.succeed(References.MinimumLogLevel, "All")),
    ),
  )
