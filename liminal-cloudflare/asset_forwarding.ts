import { Layer } from "effect"

import { Assets } from "./Assets.ts"
import * as Entry from "./Entry.ts"

export default Assets.forward.pipe(Entry.make(Layer.empty))
