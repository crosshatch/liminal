import { Effect } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

import * as Binding from "./Binding.ts"
import { NativeRequest } from "./NativeRequest.ts"

export class Assets extends Binding.Service<Assets>()(
  "liminal/cloudflare/Assets",
  "ASSETS",
  (value): value is { fetch: typeof fetch } => "fetch" in value,
) {
  static readonly forward = Effect.gen({ self: this }, function* () {
    const assets = yield* this
    const request = yield* NativeRequest
    const response = yield* Effect.promise(() => assets.fetch(request))
    return HttpServerResponse.fromWeb(response)
  })
}
