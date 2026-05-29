import { Effect, Schema as S, Option, Context, Layer } from "effect"

import * as Binding from "./Binding.ts"
import type { Env } from "./Env.ts"

export interface KvDefinition {
  readonly key: S.Top & { Encoded: string }

  readonly value: S.Top

  readonly binding: string
}

export interface Kv<Self, Id extends string, D extends KvDefinition> extends Context.Service<Self, KVNamespace> {
  new (_: never): Context.ServiceClass.Shape<Id, KVNamespace>

  readonly layer: Layer.Layer<Self, S.SchemaError, Env>

  readonly "~": {
    readonly key: D["key"]

    readonly value: S.fromJsonString<
      S.Codec<D["value"]["Type"], S.Json, D["value"]["DecodingServices"], D["value"]["EncodingServices"]>
    >
  }
}

export const Service =
  <Self>() =>
  <Id extends string, D extends KvDefinition>(id: Id, definition: D): Kv<Self, Id, D> => {
    const tag = Context.Service<Self, KVNamespace>()(id)
    return Object.assign(tag, {
      layer: Binding.layer(tag, ["get", "put", "delete", "list", "getWithMetadata"])(definition.binding),
      "~": {
        key: definition.key,
        value: S.fromJsonString(S.toCodecJson(definition.value)),
      },
    })
  }

export const put = Effect.fnUntraced(function* <Self, Id extends string, D extends KvDefinition>(
  kv: Kv<Self, Id, D>,
  key: D["key"]["Type"],
  value: D["value"]["Type"],
) {
  const resolved = yield* kv
  const keyEncoded = yield* S.encodeEffect(kv["~"].key)(key)
  const valueEncoded = yield* S.encodeEffect(kv["~"].value)(value)
  yield* Effect.promise(() => resolved.put(keyEncoded, valueEncoded))
})

export const get = Effect.fnUntraced(function* <Self, Id extends string, D extends KvDefinition>(
  kv: Kv<Self, Id, D>,
  key: D["key"]["Type"],
) {
  const resolved = yield* kv
  const keyEncoded = yield* S.encodeEffect(kv["~"].key)(key)
  const value = yield* Effect.promise(() => resolved.get(keyEncoded))
  if (value === null) {
    return Option.none()
  }
  return yield* S.decodeUnknownEffect(kv["~"].value)(value).pipe(Effect.map(Option.some))
})

export const remove = Effect.fnUntraced(function* <Self, Id extends string, D extends KvDefinition>(
  kv: Kv<Self, Id, D>,
  key: D["key"]["Type"],
) {
  const resolved = yield* kv
  const keyEncoded = yield* S.encodeEffect(kv["~"].key)(key)
  yield* Effect.promise(() => resolved.delete(keyEncoded))
})
