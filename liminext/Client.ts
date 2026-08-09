import { Schema as S, Context, Stream, Layer } from "effect"

import type * as Definition from "./Definition.ts"
import * as Method from "./Method.ts"
import * as Topic from "./Topic.ts"

export interface ClientDefinition {
  readonly actor?: S.Struct.Fields | S.Top | undefined
  readonly client?: S.Struct.Fields | S.Top | undefined
  readonly topics?: Topic.TopicDefinitions | undefined
  readonly methods?: Method.MethodDefinitions | undefined
}

export interface ClientProtocol {
  readonly actor: S.Top
  readonly client: S.Top
  readonly topics: Record<string, Topic.TopicProtocol>
  readonly methods: Record<string, Method.MethodProtocol>
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
  }
}

const TypeId = "~liminal/Client" as const

// TODO: rename?
export interface State<P extends ClientProtocol> {
  readonly actor: P["actor"]["Type"]

  readonly client: P["client"]["Type"]
}

export interface Client<P extends ClientProtocol, R> {
  readonly state: Stream.Stream<State<P>, never, R>

  readonly topics: Topic.Topics<P["topics"], R>

  readonly methods: Method.ActorMethods<P["methods"], R>
}

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
>(
  service: Service<Self, Identifier, P>,
  config: {
    readonly baseUrl?: string | undefined
    readonly handlers: Handlers
  },
) => Layer.Layer<Self, never, Exclude<Method.HandlerServices<Handlers>, Self>>
