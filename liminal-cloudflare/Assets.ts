import { HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

import * as Binding from "./Binding.ts"
import { NativeRequest } from "./NativeRequest.ts"

export class Assets extends Binding.Service<Assets>()(
  "liminal/cloudflare/Assets",
  "ASSETS",
  (value): value is { fetch: typeof fetch } => "fetch" in value,
) {
  static readonly forward = Effect.gen(this, function* () {
    const assets = yield* this
    const request = yield* NativeRequest
    const response = yield* Effect.promise(() => assets.fetch(request))
    return yield* HttpServerResponse.fromWeb(response)
  })
}
