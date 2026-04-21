import { Layer, Effect } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http";
import { Entry } from "cloudflare";
import { boundLayer } from "liminal/_util/boundLayer";

import { ApiLive } from "./ApiLive.ts";

export default ApiLive.pipe(
  Layer.provide(HttpServer.layerServices),
  HttpRouter.toHttpEffect,
  Effect.flatMap((v) => v),
  Effect.tapCause(Effect.logError),
  Effect.catchCause(() => Effect.succeed(HttpServerResponse.empty({ status: 500 }))),
  // Entry.make(
  //   Layer.mergeAll().pipe(
  //     boundLayer("worker"),
  //   ),
  // ),
);
