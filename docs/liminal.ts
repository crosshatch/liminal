import { Layer } from "effect"
import { Assets, Entry } from "liminal-cloudflare"

export default Assets.forward.pipe(Entry.make(Layer.empty))
