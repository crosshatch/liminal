import { Layer, Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { Assets } from "liminal-cloudflare";

import { Api } from "./Api.ts";
import { FacilitatorLive } from "./FacilitatorLive/FacilitatorLive.ts";
import { SessionApiLive } from "./SessionApiLive.ts";

export const ApiLive = Layer.mergeAll(
  HttpRouter.add("GET", "/", Effect.succeed(HttpServerResponse.text("crosshatch.dev"))),
  HttpApiBuilder.layer(Api, {
    openapiPath: "/openapi.json",
  }).pipe(
    Layer.provide(
      FacilitatorLive.pipe(
        Layer.provide(
          HttpRouter.cors({
            allowedHeaders: ["*"],
            allowedMethods: ["*"],
            allowedOrigins: ["*"],
            credentials: true,
          }),
        ),
      ),
    ),
    Layer.merge(HttpApiScalar.layer(Api, { path: "/reference" })),
  ),
);
