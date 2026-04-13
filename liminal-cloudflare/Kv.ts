import { ParseResult, Effect, Schema as S, Option } from "effect"

import * as Binding from "./Binding.ts"

const TypeId = "~liminal/cloudflare/Kv" as const

export interface KvDefinition<Binding_ extends string, KeyA, ValueA, ValueI> {
  readonly binding: Binding_

  readonly key: S.Schema<KeyA, string>

  readonly value: S.Schema<ValueA, ValueI>
}

export interface Kv<Self, Id extends string, Binding_ extends string, KeyA, ValueA, ValueI> extends Binding.Binding<
  Self,
  Id,
  Binding_,
  KVNamespace,
  never,
  never,
  never
> {
  readonly [TypeId]: typeof TypeId

  readonly definition: KvDefinition<Binding_, KeyA, ValueA, ValueI>

  readonly put: (key: KeyA, value: ValueA) => Effect.Effect<void, ParseResult.ParseError, Self>

  readonly get: (key: KeyA) => Effect.Effect<Option.Option<ValueA>, ParseResult.ParseError, Self>

  readonly remove: (key: KeyA) => Effect.Effect<void, ParseResult.ParseError, Self>
}

export const Service =
  <Self>() =>
  <Id extends string, Binding_ extends string, KeyA, ValueA, ValueI>(
    id: Id,
    definition: KvDefinition<Binding_, KeyA, ValueA, ValueI>,
  ): Kv<Self, Id, Binding_, KeyA, ValueA, ValueI> => {
    const tag = Binding.Service<Self>()(
      id,
      definition.binding,
      (v): v is KVNamespace => "put" in v && "get" in v && "delete" in v,
    )

    const { key, value } = definition
    const encodeKey = S.encode(key)
    const encodeValue = S.encode(S.parseJson(value))
    const decodeValue = S.decodeUnknown(S.parseJson(value))

    const put = Effect.fnUntraced(function* (key: KeyA, value: ValueA) {
      const kv = yield* tag
      const keyEncoded = yield* encodeKey(key)
      const valueEncoded = yield* encodeValue(value)
      yield* Effect.promise(() => kv.put(keyEncoded, valueEncoded))
    })

    const get = Effect.fnUntraced(function* (key: KeyA) {
      const kv = yield* tag
      const keyEncoded = yield* encodeKey(key)
      const valueEncoded = yield* Effect.promise(() => kv.get(keyEncoded))
      if (valueEncoded) {
        return yield* decodeValue(valueEncoded).pipe(Effect.map(Option.some))
      }
      return Option.none()
    })

    const remove = Effect.fnUntraced(function* (key: KeyA) {
      const kv = yield* tag
      const keyEncoded = yield* encodeKey(key)
      yield* Effect.promise(() => kv.delete(keyEncoded))
    })

    return Object.assign(tag, { [TypeId]: TypeId, definition, put, get, remove })
  }
