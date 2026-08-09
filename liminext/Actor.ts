import { Schema as S, Context, Layer, Effect } from "effect"

import * as Client from "./Client.ts"
import * as Method from "./Method.ts"

export interface ActorDefinition {
  readonly client: Client.Service<any, string, Client.ClientProtocol>
  readonly name?: (S.Top & { readonly Encoded: string }) | undefined
  readonly attachments?: S.Struct.Fields | S.Top | undefined
}

export interface ActorProtocol {
  readonly client: Client.Service<any, string, Client.ClientProtocol>
  readonly name: S.Top & { readonly Encoded: string }
  readonly attachments: S.Top
}

export declare namespace ActorProtocol {
  export type FromDefinition<D extends ActorDefinition> = {
    readonly client: D["client"]
    readonly name: "name" extends keyof D ? (D["name"] extends S.Top ? D["name"] : S.String) : S.String
    readonly attachments: "attachments" extends keyof D
      ? D["attachments"] extends S.Struct.Fields
        ? S.Struct<D["attachments"]>
        : D extends S.Top
          ? D
          : S.Void
      : S.Void
  }
}

const TypeId = "~liminal/Actor" as const

export interface StateHandle<T extends S.Top, R> extends Effect.Effect<T["Type"], never, R> {
  readonly set: <R2 = never>(
    setter: T["Type"] | ((v: T["Type"]) => Effect.Effect<T["Type"], never, R2>),
  ) => Effect.Effect<void, never, R | R2>
}

export interface Handle<P extends ActorProtocol, R> {
  readonly disconnect: Effect.Effect<void, never, R>

  readonly methods: Method.ClientMethods<P["client"]["protocol"]["methods"], R>
}

export interface ClientHandle<P extends ActorProtocol> extends Handle<P, never> {
  readonly state: StateHandle<P["client"]["protocol"]["client"], never>

  readonly attachments: StateHandle<P["attachments"], never>
}

export interface Actor<P extends ActorProtocol, R> extends Handle<P, R> {
  readonly name: P["name"]

  readonly state: StateHandle<P["client"]["protocol"]["actor"], R>

  readonly clients: Effect.Effect<ReadonlySet<ClientHandle<P>>, never, R>
}

export interface Service<Self, Identifier extends string, P extends ActorProtocol>
  extends Context.Service<Self, Actor<P, never>>, Actor<P, Self> {
  new (_: never): Context.ServiceClass.Shape<Identifier, Actor<P, never>>

  readonly [TypeId]: typeof TypeId

  readonly protocol: P
}

export const Service =
  <Self>() =>
  <Identifier extends string, D extends ActorDefinition>(
    id: Identifier,
    _definition: D,
  ): Service<Self, Identifier, ActorProtocol.FromDefinition<D>> => {
    const service = Context.Service<Self, Actor<ActorProtocol.FromDefinition<D>, never>>()(id)
    return Object.assign(service, {
      [TypeId]: TypeId,
      protocol: null!,
      state: null!,
      attachments: null!,
      name: null!,
      clients: null!,
      disconnect: null!,
      methods: null!,
    })
  }

export declare const layer: <
  Self,
  Identifier extends string,
  P extends ActorProtocol,
  Handlers extends Method.ActorMethods<P["client"]["protocol"]["methods"], any>,
>(
  service: Service<Self, Identifier, P>,
  config: {
    readonly handlers: Handlers
  },
) => Layer.Layer<Self, never, Exclude<Method.HandlerServices<Handlers>, Self>>
