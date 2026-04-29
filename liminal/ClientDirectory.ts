import { Schema as S, Effect, Cause, Option, Ref } from "effect"

import type { TopFromString } from "./_util/schema.ts"
import type { Actor } from "./Actor.ts"
import type { ActorTransport } from "./ActorTransport.ts"
import type { ProtocolDefinition, Disconnect, Protocol } from "./Protocol.ts"

import { diagnostic } from "./_diagnostic.ts"
import { phantom } from "./_util/phantom.ts"
import * as ClientHandle from "./ClientHandle.ts"

const { span } = diagnostic("ClientDirectory")

export interface ClientEntry<Client, Handle> {
  readonly client: Client

  readonly handle: Handle
}

export interface ClientDirectory<
  Key,
  Client,
  ActorSelf,
  AttachmentFields extends S.Struct.Fields,
  D extends ProtocolDefinition,
> {
  readonly "": {
    readonly Handle: ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>
    readonly Entry: ClientEntry<Client, ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>>
  }

  readonly handles: ReadonlySet<this[""]["Handle"]>

  readonly register: (
    key: Key,
    client: Client,
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<this[""]["Handle"], S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>

  readonly get: (key: Key) => Effect.Effect<this[""]["Handle"], Cause.NoSuchElementError>

  readonly entry: (key: Key) => Effect.Effect<this[""]["Entry"], Cause.NoSuchElementError>

  readonly unregister: (key: Key) => Effect.Effect<Option.Option<this[""]["Entry"]>>
}

export interface HandleEncoders<T, AttachmentFields extends S.Struct.Fields, D extends ProtocolDefinition> {
  attachments: (
    value: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<T, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>
  event: (
    value: Protocol<D>["Event"]["Type"],
  ) => Effect.Effect<T, S.SchemaError, Protocol<D>["Event"]["EncodingServices"]>
  disconnect: Effect.Effect<T, S.SchemaError, (typeof Disconnect)["EncodingServices"]>
}

export const make = <
  Key,
  Client,
  ActorSelf,
  ActorId extends string,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
>(
  _actor: Actor<ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D>,
  {
    transport: { send, close, snapshot },
  }: {
    readonly transport: ActorTransport<Client, AttachmentFields, D>
  },
): ClientDirectory<Key, Client, ActorSelf, AttachmentFields, D> => {
  type Handle = ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>
  type Entry = ClientEntry<Client, Handle>

  const entries = new Map<Key, Entry>()
  const handles = new Set<Handle>()

  const entry = (key: Key) => Effect.fromNullishOr(entries.get(key))
  const get = (key: Key) => entry(key).pipe(Effect.map(({ handle }) => handle))

  const unregister = (key: Key) =>
    Effect.sync(() => {
      const current = entries.get(key)
      if (current) {
        entries.delete(key)
        handles.delete(current.handle)
        return Option.some(current)
      }
      return Option.none()
    }).pipe(span("unregister"))

  const register = Effect.fnUntraced(function* (
    clientKey: Key,
    client: Client,
    attachments: S.Struct<AttachmentFields>["Type"],
  ) {
    yield* snapshot(client, attachments)
    const attachmentsRef = yield* Ref.make(attachments)
    const handle: Handle = {
      attachments: Ref.get(attachmentsRef),
      save: Effect.fnUntraced(function* (attachments) {
        yield* Ref.set(attachmentsRef, attachments)
        yield* snapshot(client, attachments)
      }),
      send: (_tag, payload) =>
        send(client, {
          _tag: "Event",
          event: { _tag, ...payload } as never,
        }),
      disconnect: close(client).pipe(Effect.andThen(unregister(clientKey)), Effect.asVoid),
    }
    const previous = entries.get(clientKey)
    if (previous) {
      handles.delete(previous.handle)
    }
    entries.set(clientKey, { client, handle })
    handles.add(handle)
    return handle
  }, span("register"))

  return { ...phantom, handles, register, get, entry, unregister }
}
