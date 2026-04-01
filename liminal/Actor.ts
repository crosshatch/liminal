import { Context, Schema as S, Effect, Cause } from "effect"

import type { FieldsRecord, Fields } from "./_types.ts"
import type * as ActorClient from "./Client.ts"
import type * as ClientHandle from "./ClientHandle.ts"
import type { MethodDefinition } from "./Method.ts"
import type { Send } from "./Send.ts"

import * as Method from "./Method.ts"

export const TypeId = "~liminal/Actor" as const

export interface Service<ActorSelf, NameA, AttachmentFields extends Fields, EventDefinitions extends FieldsRecord> {
  readonly name: NameA

  readonly currentClient?: ClientHandle.ClientHandle<ActorSelf, AttachmentFields, EventDefinitions> | undefined

  readonly clients: ReadonlySet<ClientHandle.ClientHandle<ActorSelf, AttachmentFields, EventDefinitions>>
}

export interface ActorDefinition<
  NameA,
  AttachmentFields extends Fields,
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> {
  readonly name: S.Schema<NameA, string>

  readonly attachments: AttachmentFields

  readonly client: ActorClient.Client<ClientSelf, ClientId, MethodDefinitions, EventDefinitions>
}

export interface Actor<
  ActorSelf,
  ActorId extends string,
  NameA,
  AttachmentFields extends Fields,
  ActorClientSelf,
  ActorClientId extends string,
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
> extends Context.Tag<ActorSelf, Service<ActorSelf, NameA, AttachmentFields, EventDefinitions>> {
  new (_: never): Context.TagClassShape<ActorId, Service<ActorSelf, NameA, AttachmentFields, EventDefinitions>>

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
    readonly attachments: S.Schema<S.Struct<AttachmentFields>["Type"], S.Struct<AttachmentFields>["Encoded"]>
  }

  readonly assertCurrentClient: Effect.Effect<
    ClientHandle.ClientHandle<ActorSelf, AttachmentFields, EventDefinitions>,
    Cause.NoSuchElementException,
    ActorSelf
  >

  readonly sendAll: Send<ActorSelf, EventDefinitions>

  readonly evict: Effect.Effect<void, never, ActorSelf>

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
    AttachmentFields extends Fields,
    ClientSelf,
    ClientId extends string,
    MethodDefinitions extends Record<string, MethodDefinition.Any>,
    EventDefinitions extends FieldsRecord,
  >(
    id: ActorId,
    definition: ActorDefinition<NameA, AttachmentFields, ClientSelf, ClientId, MethodDefinitions, EventDefinitions>,
  ): Actor<ActorSelf, ActorId, NameA, AttachmentFields, ClientSelf, ClientId, MethodDefinitions, EventDefinitions> => {
    const tag = Context.Tag(id)<ActorSelf, Service<ActorSelf, NameA, AttachmentFields, EventDefinitions>>()

    const assertCurrentClient = Effect.gen(function* () {
      const { currentClient } = yield* tag
      return yield* Effect.fromNullable(currentClient)
    })

    const sendAll: Send<ActorSelf, EventDefinitions> = Effect.fnUntraced(function* (key, payload) {
      const { clients } = yield* tag
      for (const client of clients) {
        yield* client.send(key, payload)
      }
    })

    // TODO: more eviction
    const evict = Effect.gen(function* () {
      const { clients } = yield* tag
      for (const client of clients) {
        yield* client.disconnect
      }
    })

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
      assertCurrentClient,
      sendAll,
      evict,
      handler,
    })
  }
