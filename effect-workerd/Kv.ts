import { SchemaAST, Effect, Schema as S, Option, Context } from "effect"

import * as Binding from "./Binding.ts"

export interface KvDefinition {
  readonly key: S.Top & { Encoded: string }

  readonly value: S.Top
}

export interface Kv<Self, Id extends string, D extends KvDefinition> extends Context.Service<Self, KVNamespace> {
  new (_: never): Context.ServiceClass.Shape<Id, KVNamespace>

  readonly definition: D

  readonly transcoders: {
    readonly encodeKey: ReturnType<typeof S.encodeEffect<D["key"]>>
    readonly decodeKey: ReturnType<typeof S.decodeEffect<D["key"]>>
    readonly encodeValue: (
      input: unknown,
      options?: SchemaAST.ParseOptions | undefined,
    ) => Effect.Effect<string, S.SchemaError, D["value"]["EncodingServices"]>
    readonly decodeValue: (
      input: unknown,
      options?: SchemaAST.ParseOptions,
    ) => Effect.Effect<D["value"]["Type"], S.SchemaError, D["value"]["DecodingServices"]>
  }
}

export const Kv =
  <Self>() =>
  <Id extends string, D extends KvDefinition>(id: Id, definition: D): Kv<Self, Id, D> => {
    const tag = Context.Service<Self, KVNamespace>()(id)

    const { key, value } = definition

    const transcoders = {
      encodeKey: S.encodeEffect(key),
      decodeKey: S.decodeEffect(key),
      encodeValue: S.encodeEffect(S.fromJsonString(S.toCodecJson(value))),
      decodeValue: S.decodeUnknownEffect(S.fromJsonString(S.toCodecJson(value))),
    }

    return Object.assign(tag, {
      definition,
      transcoders,
      layer: Binding.layer(tag, ["get", "put", "delete", "list", "getWithMetadata"]),
    })
  }

export const put = Effect.fnUntraced(function* <Self, Id extends string, D extends KvDefinition>(
  kv: Kv<Self, Id, D>,
  key: D["key"]["Type"],
  value: D["value"]["Type"],
) {
  const resolved = yield* kv
  const keyEncoded = yield* kv.transcoders.encodeKey(key)
  const valueEncoded = yield* kv.transcoders.encodeValue(value)
  yield* Effect.promise(() => resolved.put(keyEncoded, valueEncoded))
})

export const get = Effect.fnUntraced(function* <Self, Id extends string, D extends KvDefinition>(
  kv: Kv<Self, Id, D>,
  key: D["key"]["Type"],
) {
  const resolved = yield* kv
  const keyEncoded = yield* kv.transcoders.encodeKey(key)
  const value = yield* Effect.promise(() => resolved.get(keyEncoded))
  if (value === null) {
    return Option.none()
  }
  return yield* kv.transcoders.decodeValue(value).pipe(Effect.map(Option.some))
})

export const remove = Effect.fnUntraced(function* <Self, Id extends string, D extends KvDefinition>(
  kv: Kv<Self, Id, D>,
  key: D["key"]["Type"],
) {
  const resolved = yield* kv
  const keyEncoded = yield* kv.transcoders.encodeKey(key)
  yield* Effect.promise(() => resolved.delete(keyEncoded))
})
