import { Layer, Effect, Schema as S, Context, flow, String, Array, Encoding, Cause } from "effect"
import { Binding, NativeRequest } from "effect-workerd"
import { SecWebSocketProtocol, close } from "effect-workerd/socket_util"
import { HttpServerResponse, HttpTraceContext } from "effect/unstable/http"
import * as Spanner from "liminal-util/Spanner"

import { type TopFromString, encodeJsonString } from "../_util/schema.ts"
import type { Actor } from "../Actor.ts"
import type { ProtocolDefinition } from "../Protocol.ts"
import type { Method } from "../Method.ts"

const span = Spanner.make(import.meta.url)

export interface ActorNamespaceDefinition<
  Methods extends Record<string, Method>,
  ActorSelf,
  ActorId extends string,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
> {
  readonly binding: string

  readonly methods: Methods

  readonly actor: Actor<ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D>
}

export interface ActorNamespace<
  NamespaceSelf,
  NamespaceId extends string,
  Methods extends Record<string, Method>,
  ActorSelf,
  ActorId extends string,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
> {
  new (_: never): Context.ServiceClass.Shape<NamespaceId, DurableObjectNamespace>

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

  readonly upgrade: (
    name: Name["Type"],
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    S.SchemaError | Encoding.EncodingError | Cause.NoSuchElementError,
    | NamespaceSelf
    | NativeRequest.NativeRequest
    | Name["EncodingServices"]
    | S.Struct<AttachmentFields>["EncodingServices"]
  >

  readonly layer: Layer.Layer<NamespaceSelf, S.SchemaError, never>
}

export const Service =
  <NamespaceSelf>() =>
  <
    NamespaceId extends string,
    Methods extends Record<string, Method>,
    ActorSelf,
    ActorId extends string,
    Name extends TopFromString,
    AttachmentFields extends S.Struct.Fields,
    ClientSelf,
    ClientId extends string,
    D extends ProtocolDefinition,
  >(
    id: NamespaceId,
    definition: ActorNamespaceDefinition<Methods, ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D>,
  ): ActorNamespace<
    NamespaceSelf,
    NamespaceId,
    Methods,
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

    const tag = Context.Service<NamespaceSelf, DurableObjectNamespace>()(id)

    const encodeName = S.encodeEffect(Name)
    const Attachments = S.Struct(AttachmentFields)
    const encodeAttachmentsString = encodeJsonString(Attachments)
    const encodeAuditionFailure = encodeJsonString(P.Audition.Failure)

    const getStub = (name: Name["Type"]) =>
      Effect.gen({ self: this }, function* () {
        const namespace = yield* tag
        const nameEncoded = yield* encodeName(name)
        return namespace.getByName(nameEncoded)
      })

    const upgrade = (name: Name["Type"], attachments: S.Struct<AttachmentFields>["Type"]) =>
      Effect.gen({ self: this }, function* () {
        const request = yield* NativeRequest.NativeRequest
        const protocols = yield* Effect.fromNullishOr(request.headers.get(SecWebSocketProtocol)).pipe(
          Effect.map(flow(String.split(","), Array.map(String.trim))),
        )
        const liminalTokenI = yield* Array.findFirstIndex(protocols, (v) => v === "liminal")
        const requestClientId = yield* Effect.fromNullishOr(protocols[liminalTokenI + 1]).pipe(
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
        const actorRequest = new Request(url, request)
        const traceHeaders = yield* Effect.currentSpan.pipe(Effect.map(HttpTraceContext.toHeaders))
        for (const [key, value] of Object.entries(traceHeaders)) {
          actorRequest.headers.set(key, value)
        }
        const stub = yield* getStub(name)
        return yield* Effect.promise(() => stub.fetch(actorRequest)).pipe(Effect.map(HttpServerResponse.raw))
      }).pipe(span("upgrade", { kind: "client" }))

    const layer = Binding.layer(tag, ["idFromName", "idFromString", "newUniqueId", "get"])(binding)

    return Object.assign(tag, { definition, upgrade, layer })
  }
