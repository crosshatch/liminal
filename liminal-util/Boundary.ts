import { Effect, Layer, References, Struct, Tracer } from "effect"

export const layer =
  (boundary: string, source: string) =>
  <ROut, E, RIn>(self: Layer.Layer<ROut, E, RIn>) => {
    const annotations = Layer.effect(
      References.CurrentLogAnnotations,
      Effect.map(References.CurrentLogAnnotations, Struct.assign({ boundary })),
    ).pipe(Layer.provideMerge(Layer.succeed(References.MinimumLogLevel, "All")))

    return Layer.fromBuild((memoMap, scope) =>
      Layer.buildWithMemoMap(self.pipe(Layer.provideMerge(annotations)), memoMap, scope).pipe(
        Effect.onError((cause) => Effect.annotateLogs(Effect.logError(cause), { __source: source })),
      ),
    )
  }

export const span =
  (boundary: string, source: string, options?: Tracer.SpanOptions | undefined) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.withSpan(effect, boundary, {
      ...options,
      attributes: {
        __source: source,
        ...options?.attributes,
      },
    })
