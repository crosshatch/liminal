import { Layer, Effect, Schema as S, Context, flow, String, Array, Encoding, Exit } from "effect"
import { Binding, NativeRequest } from "effect-workerd"
import { SecWebSocketProtocol, close } from "effect-workerd/socket_util"
import { HttpServerResponse, HttpTraceContext } from "effect/unstable/http"
import { type TopFromString, encodeJsonString } from "liminal-util/schema"
import * as Spanner from "liminal-util/Spanner"

import type { Actor } from "./Actor.ts"
import type { ActorHandle } from "./ActorHandle.ts"
import type { Methods } from "./Method.ts"
import type { ProtocolDefinition } from "./Protocol.ts"

const span = Spanner.make(import.meta.url)

export interface ActorNamespaceDefinition<
  Internal extends Methods,
  ActorSelf,
  ActorId extends string,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
> {
  readonly binding: string

  readonly internal: Internal

  readonly actor: Actor<ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D>
}

export interface ActorNamespace<
  NamespaceSelf,
  NamespaceId extends string,
  Internal extends Methods,
  ActorSelf,
  ActorId extends string,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
> {
  new (
    _: never,
  ): Context.ServiceClass.Shape<
    NamespaceId,
    DurableObjectNamespace<Rpc.DurableObjectBranded & ActorNamespace.MakeRpc<Internal, D>>
  >

  readonly definition: ActorNamespaceDefinition<
    Methods,
    ActorSelf,
    ActorId,
    Name,
    AttachmentFields,
    ClientSelf,
    ClientId,
    D
  >

  readonly bind: (name: Name["Type"]) => ActorHandle<NamespaceSelf, Internal, Name, AttachmentFields, D>

  readonly layer: Layer.Layer<NamespaceSelf, S.SchemaError, never>
}

export declare namespace ActorNamespace {
  export type MakeRpc<Internal extends Methods, D extends ProtocolDefinition> = {
    rpc: <K extends keyof Internal>(
      method: K,
      payload: Internal[K]["payload"]["Type"],
    ) => Promise<Exit.Exit<Internal[K]["success"]["Type"], Internal[K]["failure"]["Type"]>>

    proxySendAll<K extends keyof D["events"]>(event: K, payload: S.Struct<D["events"][K]>["Type"]): void
  }
}

export const Service =
  <NamespaceSelf>() =>
  <
    NamespaceId extends string,
    Internal extends Methods,
    ActorSelf,
    ActorId extends string,
    Name extends TopFromString,
    AttachmentFields extends S.Struct.Fields,
    ClientSelf,
    ClientId extends string,
    D extends ProtocolDefinition,
  >(
    id: NamespaceId,
    definition: ActorNamespaceDefinition<Internal, ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D>,
  ): ActorNamespace<
    NamespaceSelf,
    NamespaceId,
    Internal,
    ActorSelf,
    ActorId,
    Name,
    AttachmentFields,
    ClientSelf,
    ClientId,
    D
  > => {
    const { binding, actor } = definition
    const {
      definition: {
        name: Name,
        client: { key: clientId, protocol: P },
        attachments: AttachmentFields,
      },
    } = actor

    const tag = Context.Service<
      NamespaceSelf,
      DurableObjectNamespace<Rpc.DurableObjectBranded & ActorNamespace.MakeRpc<Internal, D>>
    >()(id)

    const encodeName = S.encodeEffect(Name)
    const Attachments = S.Struct(AttachmentFields)
    const encodeAttachmentsString = encodeJsonString(Attachments)
    const encodeAuditionFailure = encodeJsonString(P.Audition.Failure)

    const bind = (name: Name["Type"]): ActorHandle<NamespaceSelf, Internal, Name, AttachmentFields, D> => {
      const getStub = Effect.gen(function* () {
        const namespace = yield* tag
        const nameEncoded = yield* encodeName(name)
        return namespace.getByName(nameEncoded)
      })

      const upgrade = (attachments: S.Struct<AttachmentFields>["Type"]) =>
        Effect.gen({ self: this }, function* () {
          const request = yield* NativeRequest.NativeRequest
          const protocols = yield* Effect.fromNullishOr(request.headers.get(SecWebSocketProtocol)).pipe(
            Effect.map(flow(String.split(","), Array.map(String.trim))),
          )
          const liminalTokenI = yield* Array.findFirstIndex(protocols, (v) => v === "liminal")
          const liminalClientId = yield* Effect.fromNullishOr(protocols[liminalTokenI + 1])
          const requestClientId = yield* Effect.fromNullishOr(protocols[liminalTokenI + 2]).pipe(
            Effect.flatMap((v) => Encoding.decodeBase64UrlString(v).asEffect()),
          )
          if (requestClientId !== clientId) {
            return close(
              yield* encodeAuditionFailure({
                _tag: "Audition.Failure",
                expected: clientId,
                actual: requestClientId,
              }),
            )
          }
          const url = new URL(request.url)
          url.searchParams.set("__liminal_attachments", yield* encodeAttachmentsString(attachments))
          url.searchParams.set("__liminal_client_id", liminalClientId)
          const actorRequest = new Request(url, request)
          const traceHeaders = yield* Effect.currentSpan.pipe(Effect.map(HttpTraceContext.toHeaders))
          for (const [key, value] of Object.entries(traceHeaders)) {
            actorRequest.headers.set(key, value)
          }
          const stub = yield* getStub
          return yield* Effect.promise(() => stub.fetch(actorRequest)).pipe(Effect.map(HttpServerResponse.raw))
        }).pipe(span("upgrade", { kind: "client" }))

      const call = Effect.fnUntraced(function* <K extends keyof Internal, M extends Internal[K]>(
        method: K,
        payload: M["payload"]["Type"],
      ): Effect.fn.Return<M["success"]["Type"], M["failure"]["Type"], NamespaceSelf> {
        const stub = yield* getStub
        const exit = yield* Effect.promise(() => stub.rpc(method as never, payload as never))
        return yield* exit as any
      })

      // TODO:
      const proxySendAll = Effect.fnUntraced(function* <K extends keyof D["events"]>(
        event: K,
        payload: S.Struct<D["events"][K]>["Type"],
      ) {
        const stub = yield* getStub
        yield* Effect.promise(() => stub.proxySendAll(event as never, payload as never))
      }) as never

      return { upgrade, call, proxySendAll }
    }

    const layer = Binding.layer(tag, ["idFromName", "idFromString", "newUniqueId", "get", "getByName"])(binding)

    return Object.assign(tag, { definition, bind, layer })
  }
