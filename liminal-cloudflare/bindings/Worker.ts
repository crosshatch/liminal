import { env } from "cloudflare:workers"
import { Layer, Scope, Effect, ManagedRuntime, ConfigProvider } from "effect"
import {
  HttpServerRequest,
  HttpServerResponse,
  HttpServerError,
  HttpClient,
  FetchHttpClient,
} from "effect/unstable/http"
import * as Diagnostic from "liminal/_util/Diagnostic"
import { logCause } from "liminal/_util/logCause"

import { ExecutionContext } from "./ExecutionContext.ts"
import { NativeRequest } from "./NativeRequest.ts"

const { span } = Diagnostic.module("cloudflare.Entry")

export interface WorkerConfig<ROut, E> {
  readonly prelude: Layer.Layer<ROut, E>
  readonly handler: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    HttpServerError.HttpServerError,
    ExecutionContext | HttpServerRequest.HttpServerRequest | HttpClient.HttpClient | NativeRequest | ROut | Scope.Scope
  >
}

export const make = <ROut, E>({ handler, prelude: layer }: WorkerConfig<ROut, E>) => {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(FetchHttpClient.layer, ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
  )
  const fetch = (request: Request, _env: unknown, ctx: globalThis.ExecutionContext): Promise<Response> =>
    handler.pipe(
      Effect.map(HttpServerResponse.toWeb),
      Effect.provide([
        layer,
        Layer.succeed(ExecutionContext, ctx),
        Layer.succeed(NativeRequest, request),
        Layer.succeed(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(request)),
      ]),
      Effect.scoped,
      Effect.tapCause(logCause),
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
