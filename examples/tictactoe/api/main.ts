import { Layer, Effect } from "effect"
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http"
import { Assets, Worker } from "liminal-cloudflare/bindings"

import * as GameState from "./Games.ts"
import { KvLive } from "./KvLive.ts"
import { TicTacToeRegistry } from "./TicTacToeRegistry.ts"

export { TicTacToeRegistry }

const ApiLive = Layer.mergeAll(
  HttpRouter.add("GET", "/", Effect.succeed(HttpServerResponse.text("ok"))),
  HttpRouter.add(
    "GET",
    "/play",
    Effect.gen(function* () {
      const { gameId, player } = yield* GameState.init
      return yield* TicTacToeRegistry.upgrade(gameId, { player })
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
  handler: ApiLive.pipe(
    Layer.provide(HttpServer.layerServices),
    HttpRouter.toHttpEffect,
    Effect.flatMap((v) => v),
    Effect.provide(
      Layer.mergeAll(
        KvLive,
        TicTacToeRegistry.layer({ binding: "TICTACTOE_REGISTRY" }),
        Assets.layer({ binding: "ASSETS" }),
      ),
    ),
    Effect.catchCause(() => Effect.succeed(HttpServerResponse.empty({ status: 500 }))),
  ),
  prelude: Layer.empty,
})
