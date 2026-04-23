import { absurd, Effect, Schema as S, Context } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

import * as Binding from "./Binding.ts"

export class WorkerLoader extends Context.Service<WorkerLoader, globalThis.WorkerLoader>()(
  "liminal/cloudflare/WorkerLoader",
) {}

export const layer = Binding.layer(WorkerLoader, S.Struct({ load: S.Unknown }))

export const loader = (id: string, code: string) =>
  Effect.gen({ self: this }, function* () {
    const loader = yield* WorkerLoader
    return loader.get(id, () => ({
      compatibilityDate: "2026-04-21",
      mainModule: "main.js",
      modules: { "main.js": code },
      allowExperimental: true,
      globalOutbound: null,
    }))
  })

export const run = (id: string, request: Request) =>
  Effect.gen({ self: this }, function* () {
    const loader = yield* WorkerLoader
    const worker = loader.get(id, () => absurd<never>(null!))
    return yield* Effect.tryPromise(() => worker.getEntrypoint().fetch(request)).pipe(
      Effect.map(HttpServerResponse.fromWeb),
    )
  })
