import { DurableObject } from "cloudflare:workers"
import {
  Layer,
  Effect,
  Scope,
  Schema as S,
  Context,
  ManagedRuntime,
  ConfigProvider,
  Duration,
  flow,
  String,
  Array,
  Encoding,
  Option,
  Cause,
  Tracer,
  pipe,
} from "effect"
import { Binding, DoState, NativeRequest } from "effect-workerd"
import { Clock } from "effect-workerd/platform"
import { SecWebSocketProtocol, close } from "effect-workerd/socket_util"
import { Headers, FetchHttpClient, HttpClient, HttpServerResponse, HttpTraceContext } from "effect/unstable/http"
import { boundLayer } from "liminal-util/boundLayer"
import { logCause } from "liminal-util/logCause"
import * as Spanner from "liminal-util/Spanner"
import * as TraceUtil from "liminal-util/TraceUtil"

import type { Actor } from "../Actor.ts"
import type { ActorTransport } from "../ActorTransport.ts"
import type { ProtocolDefinition } from "../Protocol.ts"

import * as Mutex from "../_util/Mutex.ts"
import { type TopFromString, encodeJsonString, decodeJsonString } from "../_util/schema.ts"
import * as ClientDirectory from "../ClientDirectory.ts"
import * as Method from "../Method.ts"

const span = Spanner.make(import.meta.url)

export interface ActorNamespaceDefinition<
  ActorSelf,
  ActorId extends string,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
  PreludeROut,
  PreludeE,
  RunROut,
  RunE,
> {
  readonly ""?: this["actor"]["definition"]["client"]["protocol"]

  readonly actor: Actor<ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D>

  readonly prelude: Layer.Layer<
    | PreludeROut
    | NonNullable<this[""]>["F"]["Payload"]["DecodingServices"]
    | NonNullable<this[""]>["F"]["Success"]["EncodingServices"]
    | NonNullable<this[""]>["F"]["Failure"]["EncodingServices"]
    | NonNullable<this[""]>["Event"]["EncodingServices"]
    | S.Struct<AttachmentFields>["DecodingServices"]
    | S.Struct<AttachmentFields>["EncodingServices"]
    | Name["EncodingServices"]
    | Name["DecodingServices"],
    PreludeE,
    HttpClient.HttpClient
  >

  readonly layer: Layer.Layer<RunROut, RunE, ActorSelf | HttpClient.HttpClient | PreludeROut>

  readonly handlers: Method.Handlers<
    D["methods"],
    ActorSelf | HttpClient.HttpClient | PreludeROut | RunROut | Scope.Scope
  >

  readonly onConnect: Effect.Effect<
    void,
    never,
    ActorSelf | HttpClient.HttpClient | PreludeROut | RunROut | Scope.Scope
  >

  readonly hibernation?: Duration.Input | undefined
}

export interface ActorNamespace<
  NamespaceSelf,
  NamespaceId extends string,
  ActorSelf,
  ActorId extends string,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
  PreludeROut,
  PreludeE,
  RunROut,
  RunE,
> {
  new (state: DurableObjectState<{}>, env: Cloudflare.Env): DurableObject

  readonly service: Context.ServiceClass<NamespaceSelf, NamespaceId, DurableObjectNamespace>

  readonly definition: ActorNamespaceDefinition<
    ActorSelf,
    ActorId,
    Name,
    AttachmentFields,
    ClientSelf,
    ClientId,
    D,
    PreludeROut,
    PreludeE,
    RunROut,
    RunE
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

  readonly layer: (binding: string) => Layer.Layer<NamespaceSelf, S.SchemaError, never>
}

export const Service =
  <NamespaceSelf>() =>
  <
    NamespaceId extends string,
    ActorSelf,
    ActorId extends string,
    Name extends TopFromString,
    AttachmentFields extends S.Struct.Fields,
    ClientSelf,
    ClientId extends string,
    D extends ProtocolDefinition,
    PreludeROut,
    PreludeE,
    RunROut,
    RunE,
  >(
    id: NamespaceId,
    definition: ActorNamespaceDefinition<
      ActorSelf,
      ActorId,
      Name,
      AttachmentFields,
      ClientSelf,
      ClientId,
      D,
      PreludeROut,
      PreludeE,
      RunROut,
      RunE
    >,
  ): ActorNamespace<
    NamespaceSelf,
    NamespaceId,
    ActorSelf,
    ActorId,
    Name,
    AttachmentFields,
    ClientSelf,
    ClientId,
    D,
    PreludeROut,
    PreludeE,
    RunROut,
    RunE
  > => {
    const { hibernation, actor, prelude, handlers, layer, onConnect } = definition
    const {
      definition: {
        name: Name,
        client: { key: clientId, protocol: P },
        attachments: AttachmentFields,
      },
    } = actor

    const encodeName = S.encodeEffect(Name)

    const Attachments = S.Struct(AttachmentFields)
    const SocketAttachment = S.Struct({
      attachments: S.toCodecJson(Attachments),
      session: TraceUtil.TraceSession,
    })
    const encodeSocketAttachment = S.encodeEffect(SocketAttachment)
    const decodeSocketAttachment = S.decodeUnknownEffect(SocketAttachment)
    const encodeAttachmentsString = encodeJsonString(Attachments)
    const decodeAttachmentsString = decodeJsonString(Attachments)

    const encodeAuditionSuccess = encodeJsonString(P.Audition.Success)
    const encodeAuditionFailure = encodeJsonString(P.Audition.Failure)
    const decodeClientM = decodeJsonString(P.Client)
    const encodeFSuccess = encodeJsonString(P.F.Success)
    const encodeFFailure = encodeJsonString(P.F.Failure)

    const encodeEvent = encodeJsonString(P.Event)

    const transport: ActorTransport<
      {
        readonly socket: WebSocket
        readonly session: typeof TraceUtil.TraceSession.Type
      },
      AttachmentFields,
      D
    > = {
      send: ({ socket, session }, event) =>
        Effect.gen(function* () {
          const eventTag = (event.event as { readonly _tag: string })._tag
          yield* Effect.gen(function* () {
            const trace = yield* TraceUtil.currentTrace
            const encoded = yield* encodeEvent({
              ...event,
              ...(trace && { trace }),
            })
            yield* Effect.sync(() => socket.send(encoded))
          }).pipe(
            span("event.send", {
              attributes: {
                _tag: eventTag,
                ...sessionAttributes(session),
              },
              kind: "producer",
              links: [sessionLink(session)],
            }),
          )
        }),
      close: ({ socket }) => Effect.sync(() => socket.close(1000)),
      snapshot: ({ socket, session }, attachments) =>
        encodeSocketAttachment({ attachments, session }).pipe(
          Effect.andThen((v) => Effect.sync(() => socket.serializeAttachment(v))),
        ),
    }

    const sessionAttributes = (session: typeof TraceUtil.TraceSession.Type) => ({
      "liminal.session.id": session.sessionId,
    })

    const sessionLink = (session: typeof TraceUtil.TraceSession.Type, attributes: Record<string, unknown> = {}) =>
      TraceUtil.toLink(session.trace, {
        "liminal.link": "session",
        ...sessionAttributes(session),
        ...attributes,
      })

    class NameDecoded extends Context.Service<NameDecoded, Name["Type"]>()(
      "liminal/WorkerdActorNamespace/NameDecoded",
    ) {}

    return class extends DurableObject {
      static definition = definition
      static service = Context.Service<NamespaceSelf, DurableObjectNamespace>()(id)
      static layer = Binding.layer(this.service, ["idFromName", "idFromString", "newUniqueId", "get"])

      readonly runtime
      readonly directory = ClientDirectory.make(actor, {
        transport,
      })

      constructor(state: DurableObjectState<{}>, env: Cloudflare.Env) {
        super(state, env)
        if (hibernation) {
          Option.andThen(
            Duration.fromInput(hibernation),
            flow(Duration.toMillis, state.setHibernatableWebSocketEventTimeout),
          )
        }

        const Live = Layer.mergeAll(
          FetchHttpClient.layer,
          Layer.succeed(DoState.DoState, state),
          Mutex.layer,
          Layer.effect(NameDecoded, S.decodeUnknownEffect(Name)(state.id.name)).pipe(
            Layer.provideMerge(
              prelude.pipe(
                Layer.provideMerge(
                  Layer.mergeAll(FetchHttpClient.layer, ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
                ),
              ),
            ),
          ),
        ).pipe(Layer.provideMerge(Clock.layer), boundLayer("actor"))

        const hydrateAttachments = Effect.gen({ self: this }, function* () {
          for (const socket of state.getWebSockets()) {
            const { attachments, session } = yield* decodeSocketAttachment(socket.deserializeAttachment())
            yield* this.directory
              .register(socket, { socket, session }, attachments)
              .pipe(Effect.linkSpans(Tracer.externalSpan(session.trace), sessionLink(session).attributes))
          }
        }).pipe(span("hydrateAttachments"), Effect.tapCause(logCause))

        this.runtime = ManagedRuntime.make(hydrateAttachments.pipe(Layer.effectDiscard, Layer.provideMerge(Live)))
      }

      override fetch(request: Request): Promise<Response> {
        const parent = pipe(request.headers, Headers.fromInput, HttpTraceContext.fromHeaders, Option.getOrUndefined)
        return Effect.gen({ self: this }, function* () {
          const url = new URL(request.url)
          const attachments = yield* decodeAttachmentsString(url.searchParams.get("__liminal_attachments"))
          const { 0: webSocket, 1: server } = new WebSocketPair()
          const state = yield* DoState.DoState
          state.acceptWebSocket(server)
          server.send(yield* encodeAuditionSuccess({ _tag: "Audition.Success" }))
          const session = {
            sessionId: crypto.randomUUID(),
            trace: yield* Effect.currentSpan.pipe(Effect.map(TraceUtil.toTrace)),
          }
          const currentClient = yield* this.directory.register(server, { socket: server, session }, attachments)
          const name = yield* NameDecoded
          const ActorLive = Layer.succeed(actor, {
            name,
            clients: this.directory.handles,
            currentClient,
          })
          yield* onConnect.pipe(
            Effect.scoped,
            span("onConnect", {
              attributes: sessionAttributes(session),
              links: [sessionLink(session)],
            }),
            Effect.scoped,
            Effect.provide(Layer.provideMerge(layer, ActorLive)),
          )
          return new Response(null, {
            status: 101,
            webSocket,
            headers: { [SecWebSocketProtocol]: "liminal" },
          })
        }).pipe(Effect.tapCause(logCause), span("fetch", { kind: "server", parent }), this.runtime.runPromise)
      }

      override webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
        Effect.gen({ self: this }, function* () {
          const { client, handle: currentClient } = yield* this.directory.entry(socket)
          const { session } = client
          yield* Effect.annotateCurrentSpan(sessionAttributes(session))
          const name = yield* NameDecoded
          const ActorLive = Layer.succeed(actor, {
            name,
            clients: this.directory.handles,
            currentClient,
          })
          const message = yield* decodeClientM(raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : raw)
          if (message._tag === "Audition.Payload") {
            return yield* Effect.die(undefined)
          }
          if (message._tag === "Disconnect") {
            return yield* currentClient.disconnect
          }
          const { id, payload } = message
          const { _tag, value } = payload as never
          const parent = message.trace ? Tracer.externalSpan(message.trace) : undefined
          const transportSpan = yield* TraceUtil.parent
          const links = [
            sessionLink(session),
            ...(parent && transportSpan
              ? [
                  {
                    span: transportSpan,
                    attributes: {
                      "liminal.link": "transport",
                      "liminal.transport": "websocket",
                    },
                  },
                ]
              : []),
          ]
          yield* handlers[_tag]!(value).pipe(
            Effect.matchEffect({
              onSuccess: (value) =>
                encodeFSuccess({
                  _tag: "F.Success",
                  id,
                  success: { _tag, value } as never,
                }),
              onFailure: (value) =>
                encodeFFailure({
                  _tag: "F.Failure",
                  id,
                  failure: { _tag, value } as never,
                }),
            }),
            span("handler", {
              attributes: { _tag, ...sessionAttributes(session) },
              kind: "server",
              parent,
              links,
            }),
            Effect.andThen((v) => Effect.sync(() => socket.send(v))),
            Effect.scoped,
            Effect.provide(Layer.provideMerge(layer, ActorLive)),
          )
        }).pipe(Effect.scoped, Mutex.task, Effect.tapCause(logCause), span("webSocketMessage"), this.runtime.runFork)
      }

      override webSocketClose(socket: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
        Effect.gen({ self: this }, function* () {
          const entry = yield* this.directory
            .entry(socket)
            .pipe(Effect.catchTag("NoSuchElementError", () => Effect.undefined))
          if (!entry) {
            return
          }
          const {
            client: { session },
          } = entry
          yield* Effect.annotateCurrentSpan(sessionAttributes(session))
          yield* this.directory.unregister(socket)
        }).pipe(Effect.tapCause(logCause), span("webSocketClose"), this.runtime.runFork)
      }

      override webSocketError(socket: WebSocket, cause: unknown) {
        Effect.gen({ self: this }, function* () {
          const {
            client: { session },
          } = yield* this.directory.entry(socket)
          yield* Effect.annotateCurrentSpan(sessionAttributes(session))
          yield* this.directory.unregister(socket)
          yield* Effect.annotateLogs(Effect.logDebug("SocketErrored"), { cause })
        }).pipe(Effect.tapCause(logCause), span("webSocketError"), this.runtime.runFork)
      }

      static readonly upgrade = (name: Name["Type"], attachments: S.Struct<AttachmentFields>["Type"]) =>
        Effect.gen({ self: this }, function* () {
          const namespace = yield* this.service
          const nameEncoded = yield* encodeName(name)
          const stub = namespace.getByName(nameEncoded)
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
          return yield* Effect.gen(function* () {
            const actorRequest = new Request(url, request)
            const traceHeaders = yield* Effect.currentSpan.pipe(Effect.map(HttpTraceContext.toHeaders))
            for (const [key, value] of Object.entries(traceHeaders)) {
              actorRequest.headers.set(key, value)
            }
            return yield* Effect.promise(() => stub.fetch(actorRequest)).pipe(Effect.map(HttpServerResponse.raw))
          }).pipe(
            span("durableObjectFetch", {
              kind: "client",
              attributes: {
                "liminal.transport": "durable-object-fetch",
              },
            }),
          )
        }).pipe(span("upgrade"))
    }
  }
