import { type Schema as S, Context, type Stream, type Layer, type Effect } from "effect"
import type { Socket } from "effect/unstable/socket"

import type * as Definition from "./Definition.ts"
import type * as Method from "./Method.ts"
import type * as Topic from "./Topic.ts"

export interface ClientDefinition {
  readonly actor?: S.Struct.Fields | S.Top | undefined
  readonly client?: S.Struct.Fields | S.Top | undefined
  readonly topics?: Topic.TopicDefinitions | undefined
  readonly methods?: Method.MethodDefinitions | undefined
  readonly disconnect?: S.Top | undefined
}

export interface ClientProtocol {
  readonly actor: S.Top
  readonly client: S.Top
  readonly topics: Record<string, Topic.TopicProtocol>
  readonly methods: Record<string, Method.MethodProtocol>
  readonly disconnect: S.Top
}

export declare namespace ClientProtocol {
  export type FromDefinition<D extends ClientDefinition> = {
    readonly actor: Definition.Normalize<D, "actor">
    readonly client: Definition.Normalize<D, "client">
    readonly topics: "topics" extends keyof D
      ? D["topics"] extends Topic.TopicDefinitions
        ? Topic.TopicProtocols.FromDefinitions<D["topics"]>
        : {}
      : {}
    readonly methods: "methods" extends keyof D
      ? D["methods"] extends Method.MethodDefinitions
        ? Method.MethodProtocols.FromDefinitions<D["methods"]>
        : {}
      : {}
    readonly disconnect: "disconnect" extends keyof D
      ? D["disconnect"] extends S.Top
        ? D["disconnect"]
        : S.Void
      : S.Void
  }
}

const TypeId = "~liminal/Client" as const

export interface Client<P extends ClientProtocol, R> {
  readonly state: Stream.Stream<
    {
      readonly actor: P["actor"]["Type"]
      readonly client: P["client"]["Type"]
    },
    never,
    R
  >

  readonly topics: Topic.Topics<P["topics"], R>

  readonly methods: Method.ActorMethods<P["methods"], R>
}

export type Any = Client<any, any>

export interface Service<Self, Identifier extends string, P extends ClientProtocol>
  extends Context.Service<Self, Client<P, never>>, Client<P, Self> {
  new (_: never): Context.ServiceClass.Shape<Identifier, Client<P, never>>

  readonly [TypeId]: typeof TypeId

  readonly protocol: P
}

export const Service =
  <Self>() =>
  <Identifier extends string, D extends ClientDefinition>(
    id: Identifier,
    _definition: D,
  ): Service<Self, Identifier, ClientProtocol.FromDefinition<D>> => {
    const service = Context.Service<Self, Client<ClientProtocol.FromDefinition<D>, never>>()(id)
    return Object.assign(service, {
      [TypeId]: TypeId,
      protocol: null!,
      state: null!,
      topics: null!,
      methods: null!,
    })
  }

export declare const layer: <
  Self,
  Identifier extends string,
  P extends ClientProtocol,
  Handlers extends Method.ClientMethods<P["methods"], any>,
  E = never,
  R = never,
  E2 = never,
  R2 = never,
>(
  service: Service<Self, Identifier, P>,
  config: {
    readonly url?: string | undefined
    readonly handlers: Handlers
    readonly hooks?:
      | {
          readonly connect?: Effect.Effect<void, E, R> | undefined
          readonly disconnect?: (disconnect: P["disconnect"]["Type"]) => Effect.Effect<void, E2, R2> | undefined
        }
      | undefined
  },
) => Layer.Layer<Self, E | E2, Socket.WebSocketConstructor | Exclude<Method.HandlerServices<Handlers> | R | R2, Self>>
