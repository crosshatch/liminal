import { Effect, Context, Schema as S } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

import * as Binding from "./Binding.ts"
import { NativeRequest } from "./NativeRequest.ts"

export class Assets extends Context.Service<
  Assets,
  {
    readonly fetch: typeof fetch
  }
>()("liminal/cloudflare/Assets") {}

export const layer = Binding.layer(Assets, S.Struct({ fetch: S.Unknown }))

export const forward = Effect.gen({ self: this }, function* () {
  const assets = yield* Assets
  const request = yield* NativeRequest
  const response = yield* Effect.promise(() => assets.fetch(request))
  return HttpServerResponse.fromWeb(response)
})
