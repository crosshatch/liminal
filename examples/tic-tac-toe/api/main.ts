import { HttpLayerRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { Layer, Effect } from "effect"
import { Assets, Entry } from "liminal-cloudflare"

import { TicTacToeRegistry } from "./ActorRegistry.ts"
import { Database } from "./Database.ts"
import * as GameState from "./Games.ts"

export { TicTacToeRegistry }

const ApiLive = Layer.mergeAll(
  HttpLayerRouter.add("GET", "/", Effect.succeed(HttpServerResponse.text("ok"))),
  HttpLayerRouter.add(
    "GET",
    "/play",
    Effect.gen(function* () {
      const { gameId, player } = yield* GameState.init
      return yield* TicTacToeRegistry.upgrade(gameId, { player })
    }).pipe(Effect.orDie),
  ),
  HttpLayerRouter.cors({
    allowedHeaders: ["*"],
    allowedMethods: ["*"],
    allowedOrigins: ["*"],
  }),
  HttpLayerRouter.add("*", "/*", Assets.forward),
)

export default ApiLive.pipe(
  Layer.provide(HttpServer.layerContext),
  HttpLayerRouter.toHttpEffect,
  Effect.flatMap((v) => v),
  Effect.provide(Layer.mergeAll(TicTacToeRegistry.layer, Database.layer)),
  Effect.catchAll(() => HttpServerResponse.empty({ status: 500 })),
  Entry.make(Layer.empty),
)
