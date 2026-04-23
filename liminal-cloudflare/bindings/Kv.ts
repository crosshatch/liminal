import { Effect, Schema as S, Option, Context, Layer } from "effect"

import * as Binding from "./Binding.ts"

export interface Kv<
  Self,
  Id extends string,
  Key extends S.Top & { Encoded: string },
  Value extends S.Top,
> extends Context.Service<Self, KVNamespace> {
  new (_: never): Context.ServiceClass<Self, Id, KVNamespace>

  ""?: [Key, Value]

  readonly put: (key: Key["Type"], value: Value["Type"]) => Effect.Effect<void, S.SchemaError, Self>

  readonly get: (key: Key["Type"]) => Effect.Effect<Option.Option<Value["Type"]>, S.SchemaError, Self>

  readonly remove: (key: Key["Type"]) => Effect.Effect<void, S.SchemaError, Self>

  readonly layer: (binding: string) => Layer.Layer<Self, Binding.BindingError | S.SchemaError>
}

export const Kv =
  <Self>() =>
  <Id extends string, Key extends S.Top & { Encoded: string }, Value extends S.Top>(
    id: Id,
    definition: {
      readonly key: Key
      readonly value: Value
    },
  ): Kv<Self, Id, Key, Value> => {
    const tag = Context.Service<Self, KVNamespace>()(id)

    const { key, value } = definition
    const encodeKey = S.encodeEffect(key)
    const encodeValue = S.encodeEffect(S.fromJsonString(S.toCodecJson(value)))
    const decodeValue = S.decodeUnknownEffect(S.fromJsonString(S.toCodecJson(value)))

    const put = Effect.fnUntraced(function* (key: Key["Type"], value: Value["Type"]) {
      const kv = yield* tag
      const keyEncoded = yield* encodeKey(key)
      const valueEncoded = yield* encodeValue(value)
      yield* Effect.promise(() => kv.put(keyEncoded, valueEncoded))
    })

    const get = Effect.fnUntraced(function* (key: Key["Type"]) {
      const kv = yield* tag
      const keyEncoded = yield* encodeKey(key)
      const valueEncoded = yield* Effect.promise(() => kv.get(keyEncoded))
      if (valueEncoded) {
        return yield* decodeValue(valueEncoded).pipe(Effect.map(Option.some))
      }
      return Option.none()
    })

    const remove = Effect.fnUntraced(function* (key: Key["Type"]) {
      const kv = yield* tag
      const keyEncoded = yield* encodeKey(key)
      yield* Effect.promise(() => kv.delete(keyEncoded))
    })

    const layer = Binding.layer(
      tag,
      S.Struct({
        put: S.Unknown,
        get: S.Unknown,
        delete: S.Unknown,
      }),
    )
    return Object.assign(tag, { definition, put, get, remove, layer }) as never
  }
