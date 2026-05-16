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
  Option,
  Tracer,
  pipe,
  Exit,
} from "effect"
import { DoState } from "effect-workerd"
import { Clock } from "effect-workerd/platform"
import { SecWebSocketProtocol } from "effect-workerd/socket_util"
import { Headers, FetchHttpClient, HttpClient, HttpTraceContext } from "effect/unstable/http"
import { boundLayer } from "liminal-util/boundLayer"
import { logCause } from "liminal-util/logCause"
import * as Spanner from "liminal-util/Spanner"

import { type TopFromString, encodeJsonString, decodeJsonString } from "../_util/schema.ts"
import type { ActorTransport } from "../ActorTransport.ts"
import * as ClientDirectory from "../ClientDirectory.ts"
import type { ClientHandle } from "../ClientHandle.ts"
import type { ProtocolDefinition } from "../Protocol.ts"
import * as Tracing from "../Tracing.ts"
import { sessionAttributes, SessionId, sessionLink } from "../Tracing.ts"
import type { ActorNamespace } from "./WorkerdActorNamespace.ts"
import type { Handlers, Methods } from "../Method.ts"

const span = Spanner.make(import.meta.url)

export interface ActorRuntimeDefinition<
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
  PreludeROut,
  PreludeE,
  RunROut,
  RunE,
> {
  readonly ""?: this["namespace"]["definition"]["actor"]["definition"]["client"]["protocol"]

  readonly namespace: ActorNamespace<
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
  >

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

  readonly external: Handlers<D["external"], ActorSelf | HttpClient.HttpClient | PreludeROut | RunROut | Scope.Scope>

  readonly internal: Handlers<Internal, ActorSelf | HttpClient.HttpClient | PreludeROut | RunROut | Scope.Scope>

  readonly hydrate: Effect.Effect<
    S.Struct<D["state"]>["Type"],
    never,
    ActorSelf | HttpClient.HttpClient | PreludeROut | RunROut | Scope.Scope
  >

  readonly onDisconnect: Effect.Effect<
    void,
    never,
    ActorSelf | HttpClient.HttpClient | PreludeROut | RunROut | Scope.Scope
  >

  readonly hibernation?: Duration.Input | undefined
}

export const make = <
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
  PreludeROut,
  PreludeE,
  RunROut,
  RunE,
>(
  definition: ActorRuntimeDefinition<
    NamespaceSelf,
    NamespaceId,
    Internal,
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
): (new (state: DurableObjectState<{}>, env: Cloudflare.Env) => DurableObject) => {
  const {
    hibernation,
    prelude,
    external,
    layer,
    hydrate,
    onDisconnect,
    internal,
    namespace: {
      definition: { actor },
    },
  } = definition
  const {
    definition: {
      name: Name,
      client: { protocol: P },
      attachments: AttachmentFields,
    },
  } = actor

  const Attachments = S.Struct(AttachmentFields)
  const SocketAttachment = S.Struct({
    attachments: S.toCodecJson(Attachments),
    session: Tracing.Session,
  })
  const encodeSocketAttachment = S.encodeEffect(SocketAttachment)
  const decodeSocketAttachment = S.decodeUnknownEffect(SocketAttachment)
  const decodeAttachmentsString = decodeJsonString(Attachments)
  const encodeAuditionSuccess = encodeJsonString(P.Audition.Success)
  const decodeClient = decodeJsonString(P.Client)
  const encodeFSuccess = encodeJsonString(P.F.Success)
  const encodeFFailure = encodeJsonString(P.F.Failure)
  const encodeEvent = encodeJsonString(P.Event)

  const transport: ActorTransport<
    WebSocket,
    {
      readonly socket: WebSocket
      readonly session: typeof Tracing.Session.Type
    },
    AttachmentFields,
    D
  > = {
    key: ({ socket }) => socket,
    send: ({ socket, session }, event) =>
      Effect.gen(function* () {
        const { _tag } = event.event as never
        yield* Effect.gen(function* () {
          const trace = yield* Tracing.currentTrace
          const encoded = yield* encodeEvent({
            ...event,
            ...(trace && { trace }),
          })
          yield* Effect.sync(() => socket.send(encoded))
        }).pipe(
          span("send", {
            attributes: { _tag, ...sessionAttributes(session) },
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

  class NameDecoded extends Context.Service<NameDecoded, Name["Type"]>()("liminal/WorkerdActorNamespace/NameDecoded") {}

  return class extends DurableObject {
    readonly run
    readonly directory = ClientDirectory.make(actor, { transport })
    readonly provideActor = (currentClient: ClientHandle<ActorSelf, AttachmentFields, D>) =>
      flow(
        Effect.provide(
          Layer.provideMerge(
            layer,
            Effect.gen({ self: this }, function* () {
              const name = yield* NameDecoded
              return Layer.succeed(actor, {
                name,
                clients: this.directory.handles,
                currentClient,
              })
            }).pipe(Layer.unwrap),
          ),
        ),
        Effect.scoped,
      )
    constructor(state: DurableObjectState<{}>, env: Cloudflare.Env) {
      super(state, env)
      if (hibernation) {
        Option.andThen(
          Duration.fromInput(hibernation),
          flow(Duration.toMillis, (timeout) => state.setHibernatableWebSocketEventTimeout(timeout)),
        )
      }

      const Live = Layer.mergeAll(
        FetchHttpClient.layer,
        Layer.succeed(DoState.DoState, state),
        Layer.effect(NameDecoded, S.decodeUnknownEffect(Name)(state.id.name)),
      ).pipe(
        Layer.provideMerge(
          prelude.pipe(
            Layer.provideMerge(
              Layer.mergeAll(FetchHttpClient.layer, ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
            ),
          ),
        ),
        Layer.provideMerge(Clock.layer),
      )

      const HydrateClientsLive = Effect.gen({ self: this }, function* () {
        for (const socket of state.getWebSockets()) {
          const { attachments, session } = yield* decodeSocketAttachment(socket.deserializeAttachment())
          yield* this.directory
            .register({ socket, session }, attachments)
            .pipe(Effect.linkSpans(Tracer.externalSpan(session.trace), sessionLink(session).attributes))
        }
      }).pipe(span("hydrate"), Layer.effectDiscard)

      const runtime = ManagedRuntime.make(HydrateClientsLive.pipe(Layer.provideMerge(Live), boundLayer("actor")))

      this.run = flow(Effect.tapCause(logCause), runtime.runPromise)
    }

    override fetch(request: Request): Promise<Response> {
      return Effect.gen({ self: this }, function* () {
        const url = new URL(request.url)
        const attachments = yield* decodeAttachmentsString(url.searchParams.get("__liminal_attachments"))
        const { 0: webSocket, 1: server } = new WebSocketPair()
        const state = yield* DoState.DoState
        const session = {
          id: SessionId.make(crypto.randomUUID()),
          trace: yield* Effect.currentSpan.pipe(Effect.map(Tracing.toTraceEnvelope)),
        }
        const currentClient = yield* this.directory.register({ socket: server, session }, attachments)
        state.acceptWebSocket(server)
        const initial = yield* hydrate.pipe(
          this.provideActor(currentClient),
          span("hydrate", {
            attributes: sessionAttributes(session),
            links: [sessionLink(session)],
          }),
        )
        server.send(yield* encodeAuditionSuccess({ _tag: "Audition.Success", initial }))
        return new Response(null, {
          status: 101,
          webSocket,
          headers: { [SecWebSocketProtocol]: "liminal" },
        })
      }).pipe(
        span("fetch", {
          kind: "server",
          parent: pipe(request.headers, Headers.fromInput, HttpTraceContext.fromHeaders, Option.getOrUndefined),
        }),
        this.run,
      )
    }

    override webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
      Effect.gen({ self: this }, function* () {
        const { client, handle: currentClient } = yield* this.directory.entry(socket)
        const { session } = client
        yield* Effect.annotateCurrentSpan(sessionAttributes(session))
        const message = yield* decodeClient(raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : raw)
        if (message._tag === "Audition.Payload") {
          return yield* Effect.die(undefined)
        }
        if (message._tag === "Disconnect") {
          yield* currentClient.disconnect
          return yield* onDisconnect.pipe(
            this.provideActor(currentClient),
            span("disconnect", {
              attributes: sessionAttributes(session),
              links: [sessionLink(session)],
            }),
          )
        }
        const { id, payload } = message
        const { _tag, value } = payload as never
        const parent = message.trace ? Tracer.externalSpan(message.trace) : undefined
        const transportSpan = yield* Tracing.parent
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
        const out = yield* external[_tag]!(value).pipe(
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
          this.provideActor(currentClient),
          span("handler", {
            attributes: { _tag, ...sessionAttributes(session) },
            kind: "server",
            parent,
            links,
          }),
        )
        socket.send(out)
      }).pipe(span("socket-message"), this.run)
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
          handle: currentClient,
        } = entry
        yield* Effect.annotateCurrentSpan(sessionAttributes(session))
        yield* this.directory.unregister(socket)
        yield* onDisconnect.pipe(
          this.provideActor(currentClient),
          span("disconnect", {
            attributes: sessionAttributes(session),
            links: [sessionLink(session)],
          }),
        )
      }).pipe(span("socket-close"), this.run)
    }

    override webSocketError(socket: WebSocket, cause: unknown) {
      Effect.gen({ self: this }, function* () {
        const {
          client: { session },
          handle: currentClient,
        } = yield* this.directory.entry(socket)
        yield* Effect.annotateCurrentSpan(sessionAttributes(session))
        yield* this.directory.unregister(socket)
        yield* onDisconnect.pipe(
          this.provideActor(currentClient),
          span("disconnect", {
            attributes: sessionAttributes(session),
            links: [sessionLink(session)],
          }),
        )
        yield* Effect.annotateLogs(Effect.logDebug("SocketErrored"), { cause })
      }).pipe(span("socket-error"), this.run)
    }

    async rpc<K extends keyof Internal>(
      method: K,
      payload: Internal[K]["payload"]["Type"],
    ): Promise<Exit.Exit<Internal[K]["success"]["Type"], Internal[K]["failure"]["Type"]>> {
      const handler = internal[method]
      return await handler(payload).pipe(this.provideActor(null!), span("fn-internal"), Effect.exit, this.run)
    }
  }
}
