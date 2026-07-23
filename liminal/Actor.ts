import * as Boundary from "@crosshatch/util/Boundary"
import type { TopFromString } from "@crosshatch/util/schema"
import { Context, Schema as S, Effect, flow, Struct } from "effect"

import type * as ActorClient from "./Client.ts"
import type { ClientHandle, Sender } from "./ClientHandle.ts"
import { type ProtocolDefinition } from "./Protocol.ts"

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

  readonly all: Sender<D, ActorSelf>

  readonly others: Sender<D, ActorSelf>
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

    const all: Sender<D, ActorSelf> = {
      send: (key, payload) =>
        tag.pipe(
          Effect.flatMap(({ clients }) =>
            Effect.forEach(clients, (client) => client.send(key, payload), { concurrency: "unbounded" }),
          ),
          Boundary.span("send-all", import.meta.url),
        ),
      disconnect: tag.pipe(
        Effect.flatMap(flow(Struct.get("clients"), Effect.forEach(Struct.get("disconnect")))),
        Boundary.span("disconnect-all", import.meta.url),
      ),
    }

    const others: Sender<D, ActorSelf> = {
      send: Effect.fnUntraced(
        function* (key, payload) {
          const { clients, currentClient } = yield* tag
          yield* Effect.forEach(
            clients,
            (client) => (client === currentClient ? Effect.void : client.send(key, payload)),
            { concurrency: "unbounded" },
          )
        },
        Boundary.span("send-others", import.meta.url),
      ),
      disconnect: Effect.gen(function* () {
        const { clients, currentClient } = yield* tag
        yield* Effect.forEach(clients, (client) => (client === currentClient ? Effect.void : client.disconnect))
      }).pipe(Boundary.span("disconnect-others", import.meta.url)),
    }

    return Object.assign(tag, {
      [TypeId]: TypeId,
      definition,
      all,
      others,
    })
  }
