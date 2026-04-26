import { absurd, Effect, Context } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

import { diagnostic } from "./_diagnostic.ts"
import * as Binding from "./Binding.ts"

const { span } = diagnostic("WorkerLoader")

export class WorkerLoader extends Context.Service<WorkerLoader, globalThis.WorkerLoader>()(
  "effect-workerd/WorkerLoader",
) {}

export const layer = Binding.layer(WorkerLoader, ["load"])

export const load = (id: string, code: string) =>
  Effect.gen({ self: this }, function* () {
    const loader = yield* WorkerLoader
    return loader.get(id, () => ({
      compatibilityDate: "2026-04-21",
      mainModule: "main.js",
      modules: { "main.js": code },
      allowExperimental: true,
      globalOutbound: null,
    }))
  }).pipe(span("load", { attributes: { id } }))

export const run = (id: string, request: Request) =>
  Effect.gen({ self: this }, function* () {
    const loader = yield* WorkerLoader
    const worker = loader.get(id, () => absurd<never>(null!))
    return yield* Effect.tryPromise(() => worker.getEntrypoint().fetch(request)).pipe(
      Effect.map(HttpServerResponse.fromWeb),
    )
  }).pipe(span("run", { attributes: { id } }))
