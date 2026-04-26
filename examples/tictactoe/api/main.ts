import { Layer, Effect } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"
import { Assets, Worker } from "liminal"

import * as GameState from "./Games.ts"
import { KvLive } from "./KvLive.ts"
import { TicTacToeNamespace } from "./TicTacToeNamespace.ts"

export { TicTacToeNamespace }

const ApiLive = Layer.mergeAll(
  HttpRouter.add("GET", "/", Effect.succeed(HttpServerResponse.text("ok"))),
  HttpRouter.add(
    "GET",
    "/play",
    Effect.gen(function* () {
      const { gameId, player } = yield* GameState.init
      return yield* TicTacToeNamespace.upgrade(gameId, { player })
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
  handler: ApiLive.pipe(HttpRouter.toHttpEffect, Effect.flatten),
  prelude: Layer.mergeAll(KvLive, TicTacToeNamespace.layer("TICTACTOE"), Assets.layer("ASSETS")),
})
