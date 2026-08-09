import { Schema as S, Context, Stream, Function } from "effect"

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

export interface State<P extends ClientProtocol> {
  readonly actor: P["actor"]["Type"]
  readonly client: P["client"]["Type"]
}

export interface Client<P extends ClientProtocol> {
  readonly state: Stream.Stream<State<P>>
  readonly topics: Topic.Topics<P["topics"]>
  readonly methods: Method.Methods<P["methods"]>
}

export interface Service<Self, Identifier extends string, P extends ClientProtocol> extends Context.Service<
  Self,
  Client<P>
> {
  new (_: never): Context.ServiceClass.Shape<Identifier, Client<P>>

  readonly [TypeId]: typeof TypeId

  readonly protocol: P

  readonly state: Stream.Stream<State<P>, never, Self>
}

export const Service =
  <Self>() =>
  <Identifier extends string, D extends ClientDefinition>(
    id: Identifier,
    _definition: D,
  ): Service<Self, Identifier, ClientProtocol.FromDefinition<D>> => {
    const service = Context.Service<Self, Client<ClientProtocol.FromDefinition<D>>>()(id)
    return Object.assign(service, {
      [TypeId]: TypeId,
      protocol: null!,
      state: null!,
    })
  }

export const method = Function.dual<
  <P extends ClientProtocol, K extends keyof P["methods"]>(
    method: K,
  ) => <Self, Identifier extends string>(service: Service<Self, Identifier, P>) => Method.Method<P["methods"][K], Self>,
  <Self, Identifier extends string, P extends ClientProtocol, K extends keyof P["methods"]>(
    service: Service<Self, Identifier, P>,
    method: K,
  ) => Method.Method<P["methods"][K], Self>
>(
  2,
  <Self, Identifier extends string, P extends ClientProtocol, K extends keyof P["methods"]>(
    _service: Service<Self, Identifier, P>,
    _method: K,
  ): Method.Method<P["methods"][K], Self> => null!,
)
