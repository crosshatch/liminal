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

  readonly layer: Layer.Layer<Self, S.SchemaError>

  readonly "~": {
    readonly id: D["id"]

    readonly metadata: S.Struct<D["metadata"]>
  }
}

export const Service =
  <Self>() =>
  <Id extends string, D extends VectorizeDefinition>(id: Id, definition: D): Vectorize<Self, Id, D> => {
    const tag = Context.Service<Self, VectorizeIndex>()(id)
    return Object.assign(tag, {
      layer: Binding.layer(tag, ["upsert", "query"])(definition.binding),
      "~": {
        id: definition.id,
        metadata: S.Struct(definition.metadata),
      },
    })
  }

export const upsert = Effect.fnUntraced(function* <Self, Id extends string, D extends VectorizeDefinition>(
  index: Vectorize<Self, Id, D>,
  id: D["id"]["Type"],
  values: VectorFloatArray | number[],
  metadata: S.Struct<D["metadata"]>["Type"],
) {
  const i = yield* index
  const idEncoded = yield* S.encodeEffect(index["~"].id)(id)
  const metadataEncoded = yield* S.encodeEffect(index["~"].metadata)(metadata)
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
  const decodeId = S.decodeEffect(index["~"].id)
  const decodeMetadata = S.decodeUnknownEffect(index["~"].metadata)
  return yield* Effect.forEach(
    matches,
    ({ id, metadata }) =>
      Effect.all(
        {
          id: decodeId(id),
          metadata: decodeMetadata(metadata),
        },
        { concurrency: "unbounded" },
      ),
    { concurrency: "unbounded" },
  )
})
