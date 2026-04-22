import { Layer, Effect } from "effect"
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http"
import { Worker } from "liminal-cloudflare/bindings"

import { ApiLive } from "./ApiLive.ts"

export default ApiLive.pipe(
  Layer.provide(HttpServer.layerServices),
  HttpRouter.toHttpEffect,
  Effect.flatMap((v) => v),
  Effect.tapCause(Effect.logError),
  Effect.catchCause(() => Effect.succeed(HttpServerResponse.empty({ status: 500 }))),
  Worker.make(Layer.empty),
)
