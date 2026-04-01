import { HttpServerRequest, HttpServerResponse, HttpServerError } from "@effect/platform"
import { Layer, Scope, Effect, ManagedRuntime, ConfigProvider } from "effect"

import { ExecutionContext } from "./ExecutionContext.ts"
import * as Intrinsic from "./Intrinsic.ts"
import { NativeRequest } from "./NativeRequest.ts"

export const makeFetch =
  <ROut, E>(layer: Layer.Layer<ROut, E>) =>
  (
    handler: Effect.Effect<
      HttpServerResponse.HttpServerResponse,
      HttpServerError.HttpServerError,
      ExecutionContext | HttpServerRequest.HttpServerRequest | Intrinsic.Intrinsic | NativeRequest | ROut | Scope.Scope
    >,
  ) => {
    const runtime = ManagedRuntime.make(layer.pipe(Layer.provideMerge(Intrinsic.layer)))
    return (request: Request, env: unknown, ctx: ExecutionContext["Type"]): Promise<Response> =>
      handler.pipe(
        Effect.map(HttpServerResponse.toWeb),
        Effect.scoped,
        Effect.provide([
          Layer.succeed(ExecutionContext, ctx),
          Layer.setConfigProvider(ConfigProvider.fromJson(env)),
          Layer.succeed(NativeRequest, request),
          Layer.succeed(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(request)),
        ]),
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
