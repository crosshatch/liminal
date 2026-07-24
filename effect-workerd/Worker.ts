import * as Boundary from "@crosshatch/util/Boundary"
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

import { Env } from "./Env.ts"
import { ExecutionContext } from "./ExecutionContext.ts"
import { NativeRequest } from "./NativeRequest.ts"
import * as Clock from "./platform/Clock.ts"

export interface WorkerDefinition<PreludeROut, PreludeE, E> {
  readonly prelude: Layer.Layer<PreludeROut, PreludeE, HttpClient.HttpClient | Env>

  readonly handler: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    | ExecutionContext
    | HttpServerRequest.HttpServerRequest
    | Env
    | HttpClient.HttpClient
    | NativeRequest
    | PreludeROut
    | Scope.Scope
    | Layer.Success<typeof HttpServer.layerServices>
  >
}

export const make = <PreludeROut, PreludeE, E>({ handler, prelude }: WorkerDefinition<PreludeROut, PreludeE, E>) => {
  const fetch = (request: Request, env: unknown, ctx: globalThis.ExecutionContext): Promise<Response> => {
    let runtime:
      | undefined
      | ManagedRuntime.ManagedRuntime<
          PreludeROut | Layer.Success<typeof HttpServer.layerServices> | HttpClient.HttpClient | Env,
          PreludeE
        >
    runtime ??= ManagedRuntime.make(
      prelude.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            FetchHttpClient.layer,
            ConfigProvider.layer(ConfigProvider.fromUnknown(env)),
            Layer.succeed(Env, env as never),
            HttpServer.layerServices,
          ),
        ),
        Layer.provideMerge(Clock.layer),
        Boundary.layer("prelude", import.meta.url),
      ),
    )
    return handler.pipe(
      Effect.onError(Effect.logError),
      Effect.catchCause(() => Effect.succeed(HttpServerResponse.empty({ status: 500 }))),
      Effect.map(HttpServerResponse.toWeb),
      Effect.provide([
        Layer.succeed(ExecutionContext, ctx),
        Layer.succeed(NativeRequest, request),
        Layer.succeed(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(request)),
      ]),
      Effect.scoped,
      Boundary.span("fetch", import.meta.url, {
        kind: "server",
        parent: pipe(request.headers, Headers.fromInput, HttpTraceContext.fromHeaders, Option.getOrUndefined),
      }),
      Effect.provideService(Layer.CurrentMemoMap, runtime.memoMap),
      runtime.runPromise,
      (v) => v.finally(() => runtime.dispose()),
    )
  }

  return { fetch }
}
