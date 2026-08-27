import type { RuntimeContext } from "alchemy"
import type { DurableObject, Worker, DurableObjectServices, DurableObjectState } from "alchemy/Cloudflare"
import type { Config, Effect, Layer, Scope, Schema as S } from "effect"
import type { HttpServerRequest } from "effect/unstable/http"

import type * as Actor from "../Actor.ts"
import type { Dispatch } from "../Dispatch.ts"
import type * as Method from "../Method.ts"

export declare const Service: <ResourceSelf>() => <
  ResourceIdentifier extends string,
  ActorSelf,
  ActorIdentifier extends string,
  P extends Actor.ActorProtocol,
>(
  id: ResourceIdentifier,
  service: Actor.Service<ActorSelf, ActorIdentifier, P>,
) => Effect.Effect<DurableObject<ResourceSelf>, never, Worker | ResourceSelf> & {
  new (_: never): {
    /** @internal */
    readonly "~alchemy/name": ActorIdentifier
  }

  readonly prelude: Effect.Effect<Layer.Layer<Dispatch<ActorSelf>>>

  readonly make: <Handlers extends Method.ActorMethods<P["client"]["protocol"]["methods"], any>, RIn, E2, R>(config: {
    readonly prelude: Effect.Effect<
      Layer.Layer<
        Exclude<
          Method.HandlerServices<Handlers>,
          | ActorSelf
          | Actor.Sender
          | RuntimeContext
          | DurableObjectState
          | Scope.Scope
          | HttpServerRequest.HttpServerRequest
        >,
        Config.ConfigError,
        RIn
      >,
      E2,
      R
    >
    readonly handlers: Handlers
    // hooks: { create, destroy, hibernate, awaken, connect, disconnect, destroy }
    readonly hooks: (P["client"]["protocol"]["actor"] extends S.Void
      ? {}
      : { readonly awaken: Effect.Effect<P["client"]["protocol"]["actor"]["Type"], never, RIn> }) &
      (P["client"]["protocol"]["client"] extends S.Void
        ? {}
        : { readonly connect: Effect.Effect<P["client"]["protocol"]["client"]["Type"], never, RIn> })
  }) => Layer.Layer<ResourceSelf, E2, Exclude<R, DurableObjectServices>>
}
