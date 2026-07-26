import * as Cloudflare from "alchemy/Cloudflare"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"

export default class NexampleWorker extends Cloudflare.Worker<NexampleWorker>()(
  "NexampleWorker",
  {
    main: import.meta.url,
    dev: {
      host: "127.0.0.1",
      port: 4388,
      strictPort: true,
    },
  },
  Effect.gen(function* () {
    const fetch = HttpRouter.add(
      "GET",
      "/session",
      Effect.gen(function* () {
        return HttpServerResponse.text("ok")
      }),
    ).pipe(
      Layer.provide(
        HttpRouter.cors({
          allowedHeaders: ["*"],
          allowedMethods: ["*"],
          allowedOrigins: ["*"],
        }),
      ),
      HttpRouter.toHttpEffect,
      Effect.scoped,
      Effect.flatten,
    )
    return { fetch }
  }),
) {}
