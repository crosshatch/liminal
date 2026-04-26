import { env } from "cloudflare:workers"
import { Context, Layer, Scope, Effect, ManagedRuntime, ConfigProvider } from "effect"
import { HttpServerRequest, HttpServerResponse, HttpClient, FetchHttpClient, HttpServer } from "effect/unstable/http"

import { NativeRequest } from "./NativeRequest.ts"
import * as Diagnostic from "./util/Diagnostic.ts"
import { logCause } from "./util/logCause.ts"

const { span } = Diagnostic.module("cloudflare.Entry")

export class ExecutionContext extends Context.Service<ExecutionContext, globalThis.ExecutionContext>()(
  "liminal/ExecutionContext",
) {}

export interface WorkerConfig<PreludeROut, PreludeE, E> {
  readonly prelude: Layer.Layer<PreludeROut, PreludeE, HttpClient.HttpClient>
  readonly handler: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    | ExecutionContext
    | HttpServerRequest.HttpServerRequest
    | HttpClient.HttpClient
    | NativeRequest
    | PreludeROut
    | Scope.Scope
    | Layer.Success<typeof HttpServer.layerServices>
  >
}

export const make = <PreludeROut, PreludeE, E>({ handler, prelude }: WorkerConfig<PreludeROut, PreludeE, E>) => {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(FetchHttpClient.layer, ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
  )
  const fetch = (request: Request, _env: unknown, ctx: globalThis.ExecutionContext): Promise<Response> =>
    handler.pipe(
      Effect.tapCause(logCause),
      Effect.catchCause(() => Effect.succeed(HttpServerResponse.empty({ status: 500 }))),
      Effect.map(HttpServerResponse.toWeb),
      Effect.provide([
        prelude,
        HttpServer.layerServices,
        Layer.succeed(ExecutionContext, ctx),
        Layer.succeed(NativeRequest, request),
        Layer.succeed(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(request)),
      ]),
      Effect.scoped,
      span("fetch"),
      // Solves crashes between HMRs.
      // Without this, in-flight requests use an old memoMap; new requests use a new one.
      // Aka. cross-contamination.
      // TODO: investigate whether better-solved by https://github.com/dmmulroy/effect-cloudflare/blob/main/src/internal/wrangler.ts
      Effect.provideService(Layer.CurrentMemoMap, runtime.memoMap),
      runtime.runPromise,
    )
  return { fetch }
}
