import { Layer } from "effect"
import { R2 } from "liminal"
import { KeyValueStore } from "liminal/platform"

export const KvLive = KeyValueStore.layerR2().pipe(Layer.provide(R2.layer("BUCKET")))
