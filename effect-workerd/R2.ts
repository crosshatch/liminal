import { Context, Layer, Effect } from "effect"
import { KeyValueStore } from "effect/unstable/persistence"

import * as Binding from "./Binding.ts"

export class R2 extends Context.Service<R2, R2Bucket>()("effect-workerd/R2") {}

export const layer = Binding.layer(R2, ["put", "get"])

export const layerKeyValueStore = ({ root }: { readonly root?: string | undefined } = {}) => {
  const prefix = root === undefined ? "" : root.endsWith("/") ? root : `${root}/`
  const toKey = (key: string) => `${prefix}${key}`
  const lsOptions = (cursor: string | undefined): R2ListOptions =>
    cursor
      ? prefix
        ? { cursor, limit: 1000, prefix }
        : { cursor, limit: 1000 }
      : prefix
        ? { limit: 1000, prefix }
        : { limit: 1000 }

  return Layer.effect(
    KeyValueStore.KeyValueStore,
    Effect.gen(function* () {
      const r2 = yield* R2
      return KeyValueStore.make({
        get: (key) =>
          Effect.tryPromise({
            try: async () => {
              const object = await r2.get(toKey(key))
              return object === null ? undefined : await object.text()
            },
            catch: (cause) =>
              new KeyValueStore.KeyValueStoreError({
                method: "get",
                key,
                message: `Unable to get item with key ${key}`,
                cause,
              }),
          }),
        getUint8Array: (key) =>
          Effect.tryPromise({
            try: async () => {
              const object = await r2.get(toKey(key))
              return object === null ? undefined : new Uint8Array(await object.arrayBuffer())
            },
            catch: (cause) =>
              new KeyValueStore.KeyValueStoreError({
                method: "getUint8Array",
                key,
                message: `Unable to get item with key ${key}`,
                cause,
              }),
          }),
        set: (key, value) =>
          Effect.tryPromise({
            try: () => r2.put(toKey(key), value),
            catch: (cause) =>
              new KeyValueStore.KeyValueStoreError({
                method: "set",
                key,
                message: `Unable to set item with key ${key}`,
                cause,
              }),
          }).pipe(Effect.asVoid),
        remove: (key) =>
          Effect.tryPromise({
            try: () => r2.delete(toKey(key)),
            catch: (cause) =>
              new KeyValueStore.KeyValueStoreError({
                method: "remove",
                key,
                message: `Unable to remove item with key ${key}`,
                cause,
              }),
          }),
        clear: Effect.tryPromise({
          try: async () => {
            let cursor: string | undefined
            do {
              const listed = await r2.list(lsOptions(cursor))
              if (listed.objects.length > 0) {
                await r2.delete(listed.objects.map((o) => o.key))
              }
              cursor = listed.truncated ? listed.cursor : undefined
            } while (cursor)
          },
          catch: (cause) =>
            new KeyValueStore.KeyValueStoreError({
              method: "clear",
              message: `Unable to clear storage`,
              cause,
            }),
        }),
        size: Effect.tryPromise({
          try: async () => {
            let total = 0
            let cursor: string | undefined
            do {
              const listed = await r2.list(lsOptions(cursor))
              total += listed.objects.length
              cursor = listed.truncated ? listed.cursor : undefined
            } while (cursor)
            return total
          },
          catch: (cause) =>
            new KeyValueStore.KeyValueStoreError({
              method: "size",
              message: `Unable to get size`,
              cause,
            }),
        }),
      })
    }),
  )
}
