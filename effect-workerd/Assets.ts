import { Effect, Context } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

import * as Binding from "./Binding.ts"
import { Env } from "./Env.ts"
import { NativeRequest } from "./NativeRequest.ts"

export class Assets extends Context.Service<
  Assets,
  {
    readonly fetch: typeof fetch
  }
>()("effect-workerd/Assets") {}

export const layer = Binding.layer(Assets, ["fetch"])

export const forward = Effect.gen({ self: this }, function* () {
  const assets = yield* Assets
  const request = yield* NativeRequest
  const response = yield* Effect.promise(() => assets.fetch(request))
  return HttpServerResponse.fromWeb(response)
})

export const forwardIfAvailable = Effect.gen(function* () {
  const env = yield* Env
  const assets = env.ASSETS
  if (!assets || typeof assets !== "object" || assets === null || !("fetch" in assets)) {
    return HttpServerResponse.empty({ status: 404 })
  }
  const request = yield* NativeRequest
  const response = yield* Effect.promise(() => (assets as { fetch: typeof fetch }).fetch(request))
  return HttpServerResponse.fromWeb(response)
})
