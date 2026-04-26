import { Effect, Schema as S, Option, Context, Layer } from "effect"

import * as Binding from "./Binding.ts"

export interface KvDefinition {
  readonly key: S.Top & { Encoded: string }

  readonly value: S.Top
}

export interface Kv<Self, Id extends string, D extends KvDefinition> extends Context.Service<Self, KVNamespace> {
  new (_: never): Context.ServiceClass.Shape<Id, KVNamespace>

  readonly definition: D

  readonly put: (key: D["key"]["Type"], value: D["value"]["Type"]) => Effect.Effect<void, S.SchemaError, Self>

  readonly get: (key: D["key"]["Type"]) => Effect.Effect<Option.Option<D["value"]["Type"]>, S.SchemaError, Self>

  readonly remove: (key: D["key"]["Type"]) => Effect.Effect<void, S.SchemaError, Self>

  readonly layer: (binding: string) => Layer.Layer<Self, S.SchemaError>
}

export const Kv =
  <Self>() =>
  <Id extends string, D extends KvDefinition>(id: Id, definition: D): Kv<Self, Id, D> => {
    const tag = Context.Service<Self, KVNamespace>()(id)

    const { key, value } = definition
    const encodeKey = S.encodeEffect(key)
    const encodeValue = S.encodeEffect(S.fromJsonString(S.toCodecJson(value)))
    const decodeValue = S.decodeUnknownEffect(S.fromJsonString(S.toCodecJson(value)))

    const put = Effect.fnUntraced(function* (key: D["key"]["Type"], value: D["value"]["Type"]) {
      const kv = yield* tag
      const keyEncoded = yield* encodeKey(key)
      const valueEncoded = yield* encodeValue(value)
      yield* Effect.promise(() => kv.put(keyEncoded, valueEncoded))
    })

    const get = Effect.fnUntraced(function* (key: D["key"]["Type"]) {
      const kv = yield* tag
      const keyEncoded = yield* encodeKey(key)
      const valueEncoded = yield* Effect.promise(() => kv.get(keyEncoded))
      if (valueEncoded) {
        return yield* decodeValue(valueEncoded).pipe(Effect.map(Option.some))
      }
      return Option.none()
    })

    const remove = Effect.fnUntraced(function* (key: D["key"]["Type"]) {
      const kv = yield* tag
      const keyEncoded = yield* encodeKey(key)
      yield* Effect.promise(() => kv.delete(keyEncoded))
    })

    const layer = Binding.layer(tag, ["put", "get", "delete"])

    return Object.assign(tag, { definition, put, get, remove, layer }) as never
  }
