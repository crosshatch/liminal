import { Layer } from "effect"
import { R2 } from "effect-workerd"

export const KvLive = R2.layerKeyValueStore({ root: "kv" }).pipe(Layer.provide(R2.layer("BUCKET")))
