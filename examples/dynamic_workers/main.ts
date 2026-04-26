import { Layer, Effect } from "effect"
import { Worker } from "effect-workerd"
import { HttpRouter } from "effect/unstable/http"

import { ApiLive } from "./ApiLive.ts"

export default Worker.make({
  handler: ApiLive.pipe(HttpRouter.toHttpEffect, Effect.flatten),
  prelude: Layer.empty,
})
