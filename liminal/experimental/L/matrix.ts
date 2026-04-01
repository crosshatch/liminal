import { Effect, Function, Layer } from "effect"

import { branch } from "./branch.ts"

type LayerRecord = Record<string, Layer.Layer.Any>

export type MatrixEffect<A, E, R, Layers extends LayerRecord> = Effect.Effect<
  {
    readonly [K in keyof Layers]: A
  },
  E | Layer.Layer.Error<Layers[keyof Layers]>,
  R | Layer.Layer.Context<Layers[keyof Layers]>
>

export const matrix: {
  <Layers extends LayerRecord>(
    layers: Layers,
  ): <A, E, R>(effect: Effect.Effect<A, E, R>) => MatrixEffect<A, E, R, Layers>
  <Layers extends LayerRecord, A, E, R>(effect: Effect.Effect<A, E, R>, layers: Layers): MatrixEffect<A, E, R, Layers>
} = Function.dual(2, <Layers extends LayerRecord, A, E, R>(effect: Effect.Effect<A, E, R>, layers: Layers) => {
  return Effect.all(
    Object.fromEntries(
      Object.entries(layers).map(([key, Live]) => [key, effect.pipe(branch, Effect.provide(Live as never))]),
    ),
  )
})
