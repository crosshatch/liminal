import { absurd, Effect } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

import * as Binding from "./Binding.ts"

export class WorkerLoader extends Binding.Service<WorkerLoader>()(
  "liminal/cloudflare/WorkerLoader",
  "LOADER",
  (value): value is globalThis.WorkerLoader => "load" in value,
) {
  static readonly loader = (id: string, code: string) =>
    Effect.gen({ self: this }, function* () {
      const loader = yield* this
      return loader.get(id, () => ({
        compatibilityDate: "2026-04-21",
        mainModule: "main.js",
        modules: { "main.js": code },
        allowExperimental: true,
        globalOutbound: null,
      }))
    })

  static readonly run = (id: string, request: Request) =>
    Effect.gen({ self: this }, function* () {
      const loader = yield* this
      const worker = loader.get(id, () => absurd<never>(null!))
      return yield* Effect.tryPromise(() => worker.getEntrypoint().fetch(request)).pipe(
        Effect.map(HttpServerResponse.fromWeb),
      )
    })
}
