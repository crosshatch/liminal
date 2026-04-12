import { HttpLayerRouter, HttpServer, HttpServerResponse } from "@effect/platform";
import { Layer, Effect } from "effect";
import { Assets, Entry } from "liminal-cloudflare";
import { TicTacToeRegistry } from "./ActorRegistry.ts";

export { TicTacToeRegistry };

const ApiLive = Layer.mergeAll(
  HttpLayerRouter.add("GET", "/", Effect.succeed(HttpServerResponse.text("ok"))),
  HttpLayerRouter.add(
    "GET",
    "/play",
    Effect.gen(function* () {
      return yield* TicTacToeRegistry.upgrade("someId", {
        player: "X",
      });
    }).pipe(Effect.orDie),
  ),
  HttpLayerRouter.cors({
    allowedHeaders: ["*"],
    allowedMethods: ["*"],
    allowedOrigins: ["*"],
  }),
  HttpLayerRouter.add("*", "/*", Assets.forward),
);

export default ApiLive.pipe(
  Layer.provide(HttpServer.layerContext),
  HttpLayerRouter.toHttpEffect,
  Effect.flatMap((v) => v),
  Effect.provide(TicTacToeRegistry.layer),
  Effect.catchAll(() => HttpServerResponse.empty({ status: 500 })),
  Entry.make(Layer.empty),
);
