import { Effect, Layer } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

import * as Assets from "./Assets.ts"
import * as Worker from "./Worker.ts"

export default Worker.make({
  handler: Assets.forward.pipe(
    Effect.provide(Assets.layer("ASSETS")),
    Effect.catch(() => Effect.succeed(HttpServerResponse.empty({ status: 500 }))),
  ),
  prelude: Layer.empty,
})
