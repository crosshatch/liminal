import type { DurableObjectShape } from "alchemy/Cloudflare"
import type { DurableObject } from "alchemy/Cloudflare"
import type { Effect } from "effect"

import type * as Actor from "./Actor.ts"
import type * as Method from "./Method.ts"

export declare const alchemy: <
  ActorSelf,
  Identifier extends string,
  P extends Actor.ActorProtocol,
  Handlers extends Method.ActorMethods<P["client"]["protocol"]["methods"], any>,
  Shape,
>(
  service: Actor.Service<ActorSelf, Identifier, P>,
  config: {
    readonly resource: DurableObject<Shape>
    readonly handlers: Handlers
  },
) => Effect.Effect<DurableObjectShape, never, Exclude<Method.HandlerServices<Handlers>, ActorSelf>>
