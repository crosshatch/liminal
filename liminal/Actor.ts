import { Context, Schema as S, Effect } from "effect"

import type * as ActorClient from "./Client.ts"
import type * as ClientHandle from "./ClientHandle.ts"
import type { ProtocolDefinition } from "./Protocol.ts"
import type { Send } from "./Send.ts"

import * as Diagnostic from "./_util/Diagnostic.ts"
import * as Method from "./Method.ts"

const { span } = Diagnostic.module("Actor")

export const TypeId = "~liminal/Actor" as const

export interface Service<ActorSelf, NameA, AttachmentFields extends S.Struct.Fields, D extends ProtocolDefinition> {
  readonly name: NameA

  readonly currentClient: ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>

  readonly clients: ReadonlySet<ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>>
}

export interface ActorDefinition<
  NameA,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
> {
  readonly name: S.Codec<NameA, string>

  readonly attachments: AttachmentFields

  readonly client: ActorClient.Client<ClientSelf, ClientId, D>
}

export interface Actor<
  ActorSelf,
  ActorId extends string,
  NameA,
  AttachmentFields extends S.Struct.Fields,
  ActorClientSelf,
  ActorClientId extends string,
  D extends ProtocolDefinition,
> extends Context.Service<ActorSelf, Service<ActorSelf, NameA, AttachmentFields, D>> {
  new (_: never): Context.ServiceClass.Shape<ActorId, Service<ActorSelf, NameA, AttachmentFields, D>>

  readonly [TypeId]: typeof TypeId

  readonly definition: ActorDefinition<NameA, AttachmentFields, ActorClientSelf, ActorClientId, D>

  readonly schema: {
    readonly attachments: S.Codec<S.Struct<AttachmentFields>["Type"], S.Struct<AttachmentFields>["Encoded"]>
  }

  readonly sendAll: Send<ActorSelf, D>

  readonly disconnectAll: Effect.Effect<void, never, ActorSelf>

  readonly handler: <K extends keyof D["methods"], R>(
    tag: K,
    f: Method.Handler<D["methods"][K], R>,
  ) => Method.Handler<D["methods"][K], R>
}

export const Service =
  <ActorSelf>() =>
  <
    ActorId extends string,
    NameA,
    D extends ProtocolDefinition,
    AttachmentFields extends S.Struct.Fields,
    ClientSelf,
    ClientId extends string,
  >(
    id: ActorId,
    definition: ActorDefinition<NameA, AttachmentFields, ClientSelf, ClientId, D>,
  ): Actor<ActorSelf, ActorId, NameA, AttachmentFields, ClientSelf, ClientId, D> => {
    const tag = Context.Service<ActorSelf, Service<ActorSelf, NameA, AttachmentFields, D>>()(id)

    const sendAll: Send<ActorSelf, D> = (key, payload) =>
      tag.asEffect().pipe(
        Effect.flatMap(({ clients }) =>
          Effect.forEach(clients, (client) => client.send(key, payload), { concurrency: "unbounded" }),
        ),
        span("sendAll"),
      )

    const disconnectAll = tag.asEffect().pipe(
      Effect.flatMap(({ clients }) => Effect.forEach(clients, ({ disconnect }) => disconnect)),
      span("disconnectAll"),
    )

    const handler = <K extends keyof D["methods"], R>(
      _tag: K,
      f: Method.Handler<D["methods"][K], R>,
    ): Method.Handler<D["methods"][K], R> => f

    return Object.assign(tag, {
      [TypeId]: TypeId,
      definition,
      schema: {
        attachments: S.Struct(definition.attachments) as never,
      },
      sendAll,
      disconnectAll,
      handler,
    })
  }
