import { HttpServerRequest, HttpServerResponse, HttpServerError } from "@effect/platform"
import { env } from "cloudflare:workers"
import { Layer, Scope, Effect, ManagedRuntime, ConfigProvider } from "effect"
import * as Diagnostic from "liminal/_util/Diagnostic"

import { ExecutionContext } from "./ExecutionContext.ts"
import * as Intrinsic from "./Intrinsic.ts"
import { NativeRequest } from "./NativeRequest.ts"

const { span } = Diagnostic.module("cloudflare.Entry")

export const makeFetch =
  <ROut, E>(layer: Layer.Layer<ROut, E>) =>
  (
    handler: Effect.Effect<
      HttpServerResponse.HttpServerResponse,
      HttpServerError.HttpServerError,
      ExecutionContext | HttpServerRequest.HttpServerRequest | Intrinsic.Intrinsic | NativeRequest | ROut | Scope.Scope
    >,
  ) => {
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(Intrinsic.layer, Layer.setConfigProvider(ConfigProvider.fromJson(env))),
    )
    return (request: Request, _env: unknown, ctx: globalThis.ExecutionContext): Promise<Response> =>
      handler.pipe(
        Effect.map(HttpServerResponse.toWeb),
        Effect.provide([
          layer,
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

export const make =
  <ROut, E>(layer: Layer.Layer<ROut, E>) =>
  (
    handler: Effect.Effect<
      HttpServerResponse.HttpServerResponse,
      HttpServerError.HttpServerError,
      ExecutionContext | HttpServerRequest.HttpServerRequest | Intrinsic.Intrinsic | NativeRequest | ROut | Scope.Scope
    >,
  ) => ({
    fetch: makeFetch(layer)(handler),
  })
