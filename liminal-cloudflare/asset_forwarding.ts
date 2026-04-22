import { Layer } from "effect"

import { Assets } from "./bindings/Assets.ts"
import * as Worker from "./bindings/Worker.ts"

export default Assets.forward.pipe(Worker.make(Layer.empty))
