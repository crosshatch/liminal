import { Layer } from "effect"

import { Assets } from "./bindings/Assets.ts"
import * as Worker from "./bindings/Worker.ts"

export default Worker.make({
  handler: Assets.forward,
  layer: Layer.empty,
})
