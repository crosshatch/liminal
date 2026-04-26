import { Context, Schema as S, Effect } from "effect"

import type { TopFromString } from "../util/schema.ts"
import type * as ActorClient from "./Client.ts"
import type { ClientHandle, Sender } from "./ClientHandle.ts"

import * as Diagnostic from "../util/Diagnostic.ts"
import * as Method from "./Method.ts"
import { type ProtocolDefinition, Protocol } from "./Protocol.ts"

const { span } = Diagnostic.module("Actor")

export const TypeId = "~liminal/Actor" as const

export interface Service<
  ActorSelf,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  D extends ProtocolDefinition,
> {
  readonly name: Name["Type"]

  readonly currentClient: ClientHandle<ActorSelf, AttachmentFields, D>

  readonly clients: ReadonlySet<ClientHandle<ActorSelf, AttachmentFields, D>>
}

export interface ActorDefinition<
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
> {
  readonly name: Name

  readonly attachments: AttachmentFields

  readonly client: ActorClient.Client<ClientSelf, ClientId, D>
}

export interface Actor<
  ActorSelf,
  ActorId extends string,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ActorClientSelf,
  ActorClientId extends string,
  D extends ProtocolDefinition,
> extends Context.Service<ActorSelf, Service<ActorSelf, Name, AttachmentFields, D>> {
  new (_: never): Context.ServiceClass.Shape<ActorId, Service<ActorSelf, Name, AttachmentFields, D>>

  readonly [TypeId]: typeof TypeId

  readonly definition: ActorDefinition<Name, AttachmentFields, ActorClientSelf, ActorClientId, D>

  readonly all: Sender<ActorSelf, D>

  readonly others: Sender<ActorSelf, D>

  readonly handler: <K extends keyof D["methods"], R>(
    tag: K,
    f: Method.Handler<D["methods"][K], R>,
  ) => Method.Handler<D["methods"][K], R>

  readonly mergeHandlers: <H extends Method.Handlers<D["methods"], any>>(
    handlers: H,
  ) => (
    payload: Protocol<D>["F"]["Payload"]["Type"]["payload"],
  ) => Effect.Effect<
    D["methods"][keyof D["methods"]]["success"]["Type"],
    D["methods"][keyof D["methods"]]["failure"]["Type"],
    Effect.Services<ReturnType<H[keyof H]>>
  >
}

export const Service =
  <ActorSelf>() =>
  <
    ActorId extends string,
    Name extends TopFromString,
    D extends ProtocolDefinition,
    AttachmentFields extends S.Struct.Fields,
    ClientSelf,
    ClientId extends string,
  >(
    id: ActorId,
    definition: ActorDefinition<Name, AttachmentFields, ClientSelf, ClientId, D>,
  ): Actor<ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D> => {
    const tag = Context.Service<ActorSelf, Service<ActorSelf, Name, AttachmentFields, D>>()(id)

    const all: Sender<ActorSelf, D> = {
      send: (key, payload) =>
        tag.asEffect().pipe(
          Effect.flatMap(({ clients }) =>
            Effect.forEach(clients, (client) => client.send(key, payload), { concurrency: "unbounded" }),
          ),
          span("all.send"),
        ),
      disconnect: tag.asEffect().pipe(
        Effect.flatMap(({ clients }) => Effect.forEach(clients, ({ disconnect }) => disconnect)),
        span("all.disconnect"),
      ),
    }

    const others: Sender<ActorSelf, D> = {
      send: Effect.fnUntraced(function* (key, payload) {
        const { clients, currentClient } = yield* tag
        yield* Effect.forEach(
          clients,
          (client) => (client === currentClient ? Effect.void : client.send(key, payload)),
          { concurrency: "unbounded" },
        )
      }, span("others.send")),
      disconnect: Effect.gen(function* () {
        const { clients, currentClient } = yield* tag
        yield* Effect.forEach(clients, (client) => (client === currentClient ? Effect.void : client.disconnect))
      }).pipe(span("others.disconnect")),
    }

    const handler = <K extends keyof D["methods"], R>(
      _tag: K,
      f: Method.Handler<D["methods"][K], R>,
    ): Method.Handler<D["methods"][K], R> => f

    const mergeHandlers =
      <H extends Method.Handlers<D["methods"], any>>(handlers: H) =>
      (
        payload_: Protocol<D>["F"]["Payload"]["Type"]["payload"],
      ): Effect.Effect<
        D["methods"][keyof D["methods"]]["success"]["Type"],
        D["methods"][keyof D["methods"]]["failure"]["Type"],
        Effect.Services<ReturnType<H[keyof H]>>
      > => {
        const { _tag, value: payload } = payload_ as never
        const handler = handlers[_tag]!
        return handler(payload)
      }

    return Object.assign(tag, {
      [TypeId]: TypeId,
      definition,
      all,
      others,
      handler,
      mergeHandlers,
    })
  }
