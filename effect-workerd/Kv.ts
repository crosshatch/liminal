import { Effect, Schema as S, Option, Context, Layer } from "effect"

import * as Binding from "./Binding.ts"

export interface KvDefinition {
  readonly key: S.Top & { Encoded: string }

  readonly value: S.Top

  readonly binding: string
}

S.toCodecJson

export interface Kv<Self, Id extends string, D extends KvDefinition> extends Context.Service<Self, KVNamespace> {
  new (_: never): Context.ServiceClass.Shape<Id, KVNamespace>

  readonly definition: D

  readonly valueJson: S.fromJsonString<
    S.Codec<D["value"]["Type"], S.Json, D["value"]["DecodingServices"], D["value"]["EncodingServices"]>
  >
  readonly encodeKey: ReturnType<typeof S.encodeEffect<D["key"]>>
  readonly decodeKey: ReturnType<typeof S.decodeEffect<D["key"]>>
  readonly encodeValue: ReturnType<typeof S.encodeEffect<this["valueJson"]>>
  readonly decodeValue: ReturnType<typeof S.decodeUnknownEffect<this["valueJson"]>>

  readonly layer: Layer.Layer<Self, S.SchemaError, never>
}

export const Service =
  <Self>() =>
  <Id extends string, D extends KvDefinition>(id: Id, definition: D): Kv<Self, Id, D> => {
    const tag = Context.Service<Self, KVNamespace>()(id)

    const { key, value, binding } = definition

    const valueJson = S.fromJsonString(S.toCodecJson(value))

    return Object.assign(tag, {
      definition,
      valueJson,
      encodeKey: S.encodeEffect(key),
      decodeKey: S.decodeEffect(key),
      encodeValue: S.encodeEffect(valueJson),
      decodeValue: S.decodeUnknownEffect(valueJson),
      layer: Binding.layer(tag, ["get", "put", "delete", "list", "getWithMetadata"])(binding),
    })
  }

export const put = Effect.fnUntraced(function* <Self, Id extends string, D extends KvDefinition>(
  kv: Kv<Self, Id, D>,
  key: D["key"]["Type"],
  value: D["value"]["Type"],
) {
  const resolved = yield* kv
  const keyEncoded = yield* kv.encodeKey(key)
  const valueEncoded = yield* kv.encodeValue(value)
  yield* Effect.promise(() => resolved.put(keyEncoded, valueEncoded))
})

export const get = Effect.fnUntraced(function* <Self, Id extends string, D extends KvDefinition>(
  kv: Kv<Self, Id, D>,
  key: D["key"]["Type"],
) {
  const resolved = yield* kv
  const keyEncoded = yield* kv.encodeKey(key)
  const value = yield* Effect.promise(() => resolved.get(keyEncoded))
  if (value === null) {
    return Option.none()
  }
  return yield* kv.decodeValue(value).pipe(Effect.map(Option.some))
})

export const remove = Effect.fnUntraced(function* <Self, Id extends string, D extends KvDefinition>(
  kv: Kv<Self, Id, D>,
  key: D["key"]["Type"],
) {
  const resolved = yield* kv
  const keyEncoded = yield* kv.encodeKey(key)
  yield* Effect.promise(() => resolved.delete(keyEncoded))
})
