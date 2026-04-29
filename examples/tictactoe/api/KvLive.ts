import { Layer } from "effect"
import { R2 } from "effect-workerd"
import { KeyValueStore } from "effect-workerd/platform"

export const KvLive = KeyValueStore.layerR2({ root: "kv" }).pipe(Layer.provide(R2.layer("BUCKET")))
