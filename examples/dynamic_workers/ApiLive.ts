import { Layer, Effect } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi"

import { Api } from "./Api.ts"

export const ApiLive = Layer.mergeAll(
  HttpApiBuilder.layer(Api, {
    openapiPath: "/openapi.json",
  }).pipe(
    Layer.provide(
      HttpApiBuilder.group(Api, "workers", (_) =>
        Effect.succeed(
          _.handle(
            "make",
            Effect.fn(function* ({}) {
              return { id: "" }
            }),
          ),
        ),
      ).pipe(
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
)
