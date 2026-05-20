import { Context, Effect, Layer, Schema as S } from "effect"
import type { TopFromString } from "liminal/_util/schema"

import * as Binding from "./Binding.ts"

export interface VectorizeDefinition {
  readonly binding: string

  readonly id: TopFromString

  readonly metadata: Record<string, S.Top & { Encoded: string | number | boolean | Array<string> }>
}

export interface Vectorize<Self, Id extends string, D extends VectorizeDefinition> extends Context.Service<
  Self,
  VectorizeIndex
> {
  new (_: never): Context.ServiceClass.Shape<Id, VectorizeIndex>

  readonly encodeId: ReturnType<typeof S.encodeEffect<D["id"]>>
  readonly decodeId: ReturnType<typeof S.decodeEffect<D["id"]>>

  readonly metadata: S.Struct<D["metadata"]>
  readonly encodeMetadata: ReturnType<typeof S.encodeEffect<this["metadata"]>>
  readonly decodeMetadata: ReturnType<typeof S.decodeUnknownEffect<this["metadata"]>>

  readonly definition: D

  readonly layer: Layer.Layer<Self, S.SchemaError>
}

export const Service =
  <Self>() =>
  <Id extends string, D extends VectorizeDefinition>(id: Id, definition: D): Vectorize<Self, Id, D> => {
    const tag = Context.Service<Self, VectorizeIndex>()(id)

    const metadata = S.Struct(definition.metadata) as S.Struct<D["metadata"]>

    return Object.assign(tag, {
      definition,
      encodeId: S.encodeEffect(definition.id),
      decodeId: S.decodeEffect(definition.id),
      metadata,
      encodeMetadata: S.encodeEffect(metadata),
      decodeMetadata: S.decodeUnknownEffect(metadata),
      layer: Binding.layer(tag, ["upsert", "query"])(definition.binding),
    })
  }

export const upsert = Effect.fnUntraced(function* <Self, Id extends string, D extends VectorizeDefinition>(
  index: Vectorize<Self, Id, D>,
  id: D["id"]["Type"],
  values: VectorFloatArray | number[],
  metadata: S.Struct<D["metadata"]>["Type"],
) {
  const i = yield* index
  const idEncoded = yield* index.encodeId(id)
  const metadataEncoded = yield* index.encodeMetadata(metadata)
  yield* Effect.promise(() =>
    i.upsert([
      {
        id: idEncoded,
        values,
        metadata: metadataEncoded,
      },
    ]),
  )
})

export const query = Effect.fnUntraced(function* <Self, Id extends string, D extends VectorizeDefinition>(
  index: Vectorize<Self, Id, D>,
  values: VectorFloatArray | number[],
  options?: VectorizeQueryOptions | undefined,
) {
  const i = yield* index
  const { matches } = yield* Effect.promise(() => i.query(values, options))
  const result = yield* Effect.forEach(
    matches,
    ({ id, metadata }) =>
      Effect.all(
        {
          id: index.encodeId(id),
          metadata: index.decodeMetadata(metadata),
        },
        { concurrency: "unbounded" },
      ),
    { concurrency: "unbounded" },
  )
  return result as ReadonlyArray<{
    readonly id: D["id"]["Type"]
    readonly metadata: S.Struct<D["metadata"]>["Type"]
  }>
})
