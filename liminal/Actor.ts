import { Context, Schema as S, Effect } from "effect"

import type * as ActorClient from "./Client.ts"
import type * as ClientHandle from "./ClientHandle.ts"
import type { MethodDefinition } from "./Method.ts"
import type { Send } from "./Send.ts"

import * as Diagnostic from "./_util/Diagnostic.ts"
import * as Method from "./Method.ts"

const { span } = Diagnostic.module("Actor")

export const TypeId = "~liminal/Actor" as const

export interface Service<
  ActorSelf,
  NameA,
  AttachmentFields extends S.Struct.Fields,
  EventDefinitions extends Record<string, S.Struct.Fields>,
> {
  readonly name: NameA

  readonly currentClient: ClientHandle.ClientHandle<ActorSelf, AttachmentFields, EventDefinitions>

  readonly clients: ReadonlySet<ClientHandle.ClientHandle<ActorSelf, AttachmentFields, EventDefinitions>>
}

export interface ActorDefinition<
  NameA,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
> {
  readonly name: S.Codec<NameA, string>

  readonly attachments: AttachmentFields

  readonly client: ActorClient.Client<ClientSelf, ClientId, MethodDefinitions, EventDefinitions>
}

export interface Actor<
  ActorSelf,
  ActorId extends string,
  NameA,
  AttachmentFields extends S.Struct.Fields,
  ActorClientSelf,
  ActorClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
> extends Context.Service<ActorSelf, Service<ActorSelf, NameA, AttachmentFields, EventDefinitions>> {
  new (_: never): Context.ServiceClass.Shape<ActorId, Service<ActorSelf, NameA, AttachmentFields, EventDefinitions>>

  readonly [TypeId]: typeof TypeId

  readonly definition: ActorDefinition<
    NameA,
    AttachmentFields,
    ActorClientSelf,
    ActorClientId,
    MethodDefinitions,
    EventDefinitions
  >

  readonly schema: {
    readonly attachments: S.Codec<S.Struct<AttachmentFields>["Type"], S.Struct<AttachmentFields>["Encoded"]>
  }

  readonly sendAll: Send<ActorSelf, EventDefinitions>

  readonly disconnectAll: Effect.Effect<void, never, ActorSelf>

  readonly handler: <K extends keyof MethodDefinitions, R>(
    tag: K,
    f: Method.Handler<MethodDefinitions[K], R>,
  ) => Method.Handler<MethodDefinitions[K], R>
}

export const Service =
  <ActorSelf>() =>
  <
    ActorId extends string,
    NameA,
    AttachmentFields extends S.Struct.Fields,
    ClientSelf,
    ClientId extends string,
    MethodDefinitions extends Record<string, MethodDefinition.Any>,
    EventDefinitions extends Record<string, S.Struct.Fields>,
  >(
    id: ActorId,
    definition: ActorDefinition<NameA, AttachmentFields, ClientSelf, ClientId, MethodDefinitions, EventDefinitions>,
  ): Actor<ActorSelf, ActorId, NameA, AttachmentFields, ClientSelf, ClientId, MethodDefinitions, EventDefinitions> => {
    const tag = Context.Service<ActorSelf, Service<ActorSelf, NameA, AttachmentFields, EventDefinitions>>()(id)

    const sendAll: Send<ActorSelf, EventDefinitions> = (key, payload) =>
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

    const handler = <K extends keyof MethodDefinitions, R>(
      _tag: K,
      f: Method.Handler<MethodDefinitions[K], R>,
    ): Method.Handler<MethodDefinitions[K], R> => f

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
