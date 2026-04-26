import * as Assets from "./Assets.ts"
import * as Worker from "./Worker.ts"

export default Worker.make({
  handler: Assets.forward,
  prelude: Assets.layer("ASSETS"),
})
