import { Schema as S, Context, Effect, Data, Types } from "effect"
import type { HttpServerResponse } from "effect/unstable/http"

import * as Client from "./Client.ts"
import type { Dispatcher } from "./Dispatcher.ts"
import * as Method from "./Method.ts"

export interface ActorDefinition {
  readonly client: Client.Service<any, string, any>
  readonly name?: (S.Top & { readonly Encoded: string }) | undefined
  readonly attachments?: S.Struct.Fields | S.Top | undefined
}

export interface ActorProtocol {
  readonly client: Client.Service<any, string, any>
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
  <E = never, R2 = never>(
    setter:
      | T["Type"]
      | ((v: Types.DeepMutable<T["Type"]>) => T["Type"] | void | Effect.Effect<T["Type"] | void, E, R2>),
  ): Effect.Effect<void, E, R | R2>
}

export interface Handle<P extends ActorProtocol, T extends S.Top, R> {
  readonly state: StateHandle<T, R>

  readonly disconnect: (message: P["client"]["protocol"]["disconnect"]["Type"]) => Effect.Effect<void, never, R>

  readonly methods: Method.ClientMethods<P["client"]["protocol"]["methods"], R>
}

export type ClientId = typeof ClientId.Type
export const ClientId = S.String.pipe(S.brand("liminal/Actor/ClientId"))

export interface ClientHandle<P extends ActorProtocol> extends Handle<P, P["client"]["protocol"]["client"], never> {
  readonly id: ClientId

  readonly attachments: StateHandle<P["attachments"], never>
}

export class NoSuchClientError extends Data.TaggedError("NoSuchClientError") {}

export class Sender extends Context.Service<Sender, ClientId>()("liminal/Actor/Sender") {}

export interface Actor<P extends ActorProtocol, R> extends Handle<P, P["client"]["protocol"]["actor"], R> {
  readonly name: Effect.Effect<P["name"]["Type"], never, R>

  readonly topics: {
    readonly [K in keyof P["client"]["protocol"]["topics"]]: (
      key: P["client"]["protocol"]["topics"][K]["key"]["Type"],
    ) => StateHandle<P["client"]["protocol"]["topics"][K]["value"], R>
  }

  readonly clients: Effect.Effect<ReadonlySet<ClientHandle<P>>, never, R>

  readonly getClient: (key: ClientId) => Effect.Effect<ClientHandle<P>, NoSuchClientError, R>
}

export interface ActorHandle<Self, P extends ActorProtocol> extends Actor<P, Dispatcher<Self>> {
  readonly upgrade: (
    attachments: P["attachments"]["Type"],
  ) => Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    never,
    Dispatcher<Self> | P["attachments"]["EncodingServices"]
  >
}

export interface Service<Self, Identifier extends string, P extends ActorProtocol>
  extends Context.Service<Self, Actor<P, never>>, Actor<P, Self> {
  new (_: never): Context.ServiceClass.Shape<Identifier, Actor<P, never>>

  readonly [TypeId]: typeof TypeId

  readonly protocol: P

  readonly get: (name: P["name"]["Type"]) => ActorHandle<Self, P>

  readonly sender: Effect.Effect<ClientHandle<P>, never, Self | Sender>
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
      getClient: null!,
      get: null!,
      session: null!,
      topics: null!,
      lens: null!,
      commit: null!,
      sender: null!,
    })
  }
