import { env } from "cloudflare:workers"
import { Layer, Scope, Effect, ManagedRuntime, ConfigProvider, Option, pipe } from "effect"
import {
  Headers,
  FetchHttpClient,
  HttpClient,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
  HttpTraceContext,
} from "effect/unstable/http"
import { logCause } from "liminal-util/logCause"
import * as Spanner from "liminal-util/Spanner"

import { ExecutionContext } from "./ExecutionContext.ts"
import { NativeRequest } from "./NativeRequest.ts"
import * as Clock from "./platform/Clock.ts"

const span = Spanner.make(import.meta.url)

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
  const fetch = (request: Request, _env: unknown, ctx: globalThis.ExecutionContext): Promise<Response> => {
    let runtime:
      | undefined
      | ManagedRuntime.ManagedRuntime<
          PreludeROut | Layer.Success<typeof HttpServer.layerServices> | HttpClient.HttpClient,
          PreludeE
        >
    const memoMap = Layer.makeMemoMapUnsafe()
    runtime ??= ManagedRuntime.make(
      prelude.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            FetchHttpClient.layer,
            ConfigProvider.layer(ConfigProvider.fromUnknown(env)),
            HttpServer.layerServices,
          ),
        ),
        Layer.provideMerge(Clock.layer),
      ),
      { memoMap },
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
      span("fetch", {
        kind: "server",
        parent: pipe(request.headers, Headers.fromInput, HttpTraceContext.fromHeaders, Option.getOrUndefined),
      }),
      Effect.provideService(Layer.CurrentMemoMap, memoMap),
      runtime.runPromise,
      (v) => v.finally(() => runtime.dispose()),
    )
  }

  return { fetch }
}
