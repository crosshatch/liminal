import { Layer, Effect } from "effect"
import { Assets, Worker } from "effect-workerd"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"

import * as GameState from "./Games.ts"
import { layer as layerKv } from "./Kv.ts"
import { TicTacToeNamespace } from "./TicTacToeNamespace.ts"

export * from "./TicTacToeRuntime.ts"

const layerApi = Layer.mergeAll(
  HttpRouter.add("GET", "/health", Effect.succeed(HttpServerResponse.text("ok"))),
  HttpRouter.add(
    "GET",
    "/play",
    Effect.gen(function* () {
      const { gameId, player } = yield* GameState.init
      return yield* TicTacToeNamespace.bind(gameId).upgrade({ player })
    }),
  ),
  HttpRouter.cors({
    allowedHeaders: ["*"],
    allowedMethods: ["*"],
    allowedOrigins: ["*"],
  }),
  HttpRouter.add("*", "/*", Assets.forward),
)

export default Worker.make({
  handler: layerApi.pipe(HttpRouter.toHttpEffect, Effect.flatten),
  prelude: Layer.mergeAll(layerKv, TicTacToeNamespace.layer, Assets.layer("ASSETS")),
})
