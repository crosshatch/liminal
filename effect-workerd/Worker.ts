import { env } from "cloudflare:workers"
import { Layer, Scope, Effect, ManagedRuntime, ConfigProvider } from "effect"
import { HttpServerRequest, HttpServerResponse, HttpClient, FetchHttpClient, HttpServer } from "effect/unstable/http"
import { logCause } from "liminal-util/logCause"

import { diagnostic } from "./_diagnostic.ts"
import { ExecutionContext } from "./ExecutionContext.ts"
import { NativeRequest } from "./NativeRequest.ts"

const { span } = diagnostic("Entry")

export interface WorkerDefinition<PreludeROut, PreludeE, E> {
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

export const make = <PreludeROut, PreludeE, E>({ handler, prelude }: WorkerDefinition<PreludeROut, PreludeE, E>) => {
  let runtime:
    | undefined
    | ManagedRuntime.ManagedRuntime<
        PreludeROut | Layer.Success<typeof HttpServer.layerServices> | HttpClient.HttpClient,
        PreludeE
      >
  const fetch = (request: Request, _env: unknown, ctx: globalThis.ExecutionContext): Promise<Response> => {
    runtime ??= ManagedRuntime.make(
      prelude.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            FetchHttpClient.layer,
            ConfigProvider.layer(ConfigProvider.fromUnknown(env)),
            HttpServer.layerServices,
          ),
        ),
      ),
    )
    return handler.pipe(
      Effect.tapCause(logCause),
      Effect.catchCause(() => Effect.succeed(HttpServerResponse.empty({ status: 500 }))),
      Effect.map(HttpServerResponse.toWeb),
      Effect.provide([
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
  }

  return { fetch }
}
