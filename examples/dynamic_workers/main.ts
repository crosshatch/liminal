import { Layer, Effect } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { Worker } from "liminal"

import { ApiLive } from "./ApiLive.ts"

export default Worker.make({
  handler: ApiLive.pipe(HttpRouter.toHttpEffect, Effect.flatten),
  prelude: Layer.empty,
})
