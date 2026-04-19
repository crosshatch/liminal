import { Layer, Effect } from "effect"
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http"
import { Assets, Entry } from "liminal-cloudflare"

import { Database } from "./Database.ts"
import * as GameState from "./Games.ts"
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
    }).pipe(Effect.orDie),
  ),
  HttpRouter.cors({
    allowedHeaders: ["*"],
    allowedMethods: ["*"],
    allowedOrigins: ["*"],
  }),
  HttpRouter.add("*", "/*", Assets.forward),
)

export default ApiLive.pipe(
  Layer.provide(HttpServer.layerServices),
  HttpRouter.toHttpEffect,
  Effect.flatMap((v) => v),
  Effect.provide(Layer.mergeAll(TicTacToeRegistry.layer, Database.layer)),
  Effect.catchCause(() => Effect.succeed(HttpServerResponse.empty({ status: 500 }))),
  Entry.make(Layer.empty),
)
