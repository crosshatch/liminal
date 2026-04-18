import { References, Effect, Layer } from "effect"

import { logCause } from "./logCause.ts"

export const boundLayer = (boundary: string) =>
  Layer.provideMerge(
    Layer.effect(
      References.CurrentLogAnnotations,
      Effect.map(References.CurrentLogAnnotations.asEffect(), (existing) => ({ ...existing, _boundary: boundary })),
    ).pipe(Layer.tapCause(logCause), Layer.provideMerge(Layer.succeed(References.MinimumLogLevel, "All"))),
  )
