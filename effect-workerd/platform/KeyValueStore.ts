import { Layer, Effect } from "effect"
import { KeyValueStore } from "effect/unstable/persistence"

import { R2 } from "../R2.ts"

export const layerR2 = ({ root }: { readonly root?: string | undefined } = {}) => {
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
  const clearPage = async (r2: R2Bucket, cursor: string | undefined): Promise<void> => {
    const listed = await r2.list(lsOptions(cursor))
    if (listed.objects.length > 0) {
      await r2.delete(listed.objects.map((o) => o.key))
    }
    if (listed.truncated) {
      await clearPage(r2, listed.cursor)
    }
  }
  const countPage = async (r2: R2Bucket, cursor: string | undefined, total: number): Promise<number> => {
    const listed = await r2.list(lsOptions(cursor))
    const nextTotal = total + listed.objects.length
    return listed.truncated ? countPage(r2, listed.cursor, nextTotal) : nextTotal
  }

  return Layer.effect(
    KeyValueStore.KeyValueStore,
    Effect.gen(function* () {
      const r2 = yield* R2
      return KeyValueStore.make({
        get: (key) =>
          Effect.promise(async () => {
            const object = await r2.get(toKey(key))
            return object === null ? undefined : await object.text()
          }),
        getUint8Array: (key) =>
          Effect.promise(async () => {
            const object = await r2.get(toKey(key))
            return object === null ? undefined : new Uint8Array(await object.arrayBuffer())
          }),
        set: (key, value) => Effect.promise(() => r2.put(toKey(key), value)).pipe(Effect.asVoid),
        remove: (key) => Effect.promise(() => r2.delete(toKey(key))),
        clear: Effect.promise(() => clearPage(r2, undefined)),
        size: Effect.promise(() => countPage(r2, undefined, 0)),
      })
    }),
  )
}
