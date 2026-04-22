import { Layer } from "effect"
import { R2 } from "liminal-cloudflare/bindings"
import { KeyValueStore } from "liminal-cloudflare/platform"

export const KvLive = KeyValueStore.layerR2().pipe(Layer.provide(R2.layer({ binding: "BUCKET" })))
