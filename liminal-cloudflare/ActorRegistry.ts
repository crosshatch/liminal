import type { ProtocolDefinition } from "liminal/Protocol"

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
} from "effect"
import { HttpServerResponse, HttpClient, FetchHttpClient } from "effect/unstable/http"
import { type Actor, type Method, ClientDirectory, type ActorTransport } from "liminal"
import { SecWebSocketProtocol } from "liminal/_constants"
import { boundLayer } from "liminal/_util/boundLayer"
import * as Diagnostic from "liminal/_util/Diagnostic"
import { logCause } from "liminal/_util/logCause"
import * as Mutex from "liminal/_util/Mutex"
import { type TopFromString, encodeJsonString, decodeJsonString } from "liminal/_util/schema"

import { DoState, NativeRequest, Binding } from "./bindings/index.ts"
import { close } from "./close.ts"

const { debug, span } = Diagnostic.module("cloudflare.ActorRegistry")

export interface ActorRegistryDefinition<
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

  readonly actor: Actor.Actor<ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D>

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
    PreludeE
  >

  readonly runLayer: Layer.Layer<RunROut, RunE, ActorSelf | PreludeROut>

  readonly handlers: Method.Handlers<
    D["methods"],
    ActorSelf | RunROut | HttpClient.HttpClient | PreludeROut | Scope.Scope
  >

  readonly onConnect: Effect.Effect<
    void,
    never,
    ActorSelf | RunROut | HttpClient.HttpClient | PreludeROut | Scope.Scope
  >

  readonly hibernation?: Duration.Input | undefined
}

export interface ActorRegistry<
  RegistrySelf,
  RegistryId extends string,
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
> extends Context.Service<RegistrySelf, DurableObjectNamespace> {
  new (state: globalThis.DurableObjectState<{}>): Context.ServiceClass.Shape<RegistryId, DurableObjectNamespace>

  readonly definition: ActorRegistryDefinition<
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
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse, S.SchemaError, RegistrySelf | NativeRequest.NativeRequest>

  readonly layer: (binding: string) => Layer.Layer<RegistrySelf, S.SchemaError, never>
}

export const Service =
  <RegistrySelf>() =>
  <
    RegistryId extends string,
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
    id: RegistryId,
    definition: ActorRegistryDefinition<
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
  ): ActorRegistry<
    RegistrySelf,
    RegistryId,
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
    const { hibernation, actor, prelude, runLayer, handlers, onConnect } = definition
    const {
      definition: {
        name: Name,
        client: { key: clientId, protocol: P },
        attachments: AttachmentFields,
      },
    } = actor

    const encodeName = S.encodeEffect(Name)
    const decodeName = S.decodeUnknownEffect(Name)

    const Attachments = S.Struct(AttachmentFields)
    const encodeAttachments = S.encodeEffect(S.toCodecJson(Attachments))
    const decodeAttachments = S.decodeUnknownEffect(S.toCodecJson(Attachments))
    const encodeAttachmentsString = encodeJsonString(Attachments)
    const decodeAttachmentsString = decodeJsonString(Attachments)

    const encodeAuditionSuccess = encodeJsonString(P.Audition.Success)
    const encodeAuditionFailure = encodeJsonString(P.Audition.Failure)
    const decodeClientM = decodeJsonString(P.Client)
    const encodeFSuccess = encodeJsonString(P.F.Success)
    const encodeFFailure = encodeJsonString(P.F.Failure)

    const encodeEvent = encodeJsonString(P.Event)

    const transport: ActorTransport<WebSocket, AttachmentFields, D> = {
      send: (socket, event) => encodeEvent(event).pipe(Effect.andThen((v) => Effect.sync(() => socket.send(v)))),
      close: (socket) => Effect.sync(() => socket.close(1000)),
      snapshot: (socket, attachments) =>
        encodeAttachments(attachments).pipe(Effect.andThen((v) => Effect.sync(() => socket.serializeAttachment(v)))),
    }

    const tag = class tag extends Context.Service<RegistrySelf, DurableObjectNamespace>()(id) {
      readonly runtime
      readonly directory = ClientDirectory.make(actor, transport)

      constructor(...args: [never]) {
        super(...args)
        const [state, env] = args as never as [state: globalThis.DurableObjectState<{}>, env: unknown]

        if (hibernation) {
          Option.andThen(
            Duration.fromInput(hibernation),
            flow(Duration.toMillis, state.setHibernatableWebSocketEventTimeout),
          )
        }

        const baseLayer = Layer.mergeAll(
          prelude.pipe(Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))),
          FetchHttpClient.layer,
          Layer.succeed(DoState.DoState, state),
          Mutex.layer,
        )

        this.runtime = Effect.gen({ self: this }, function* () {
          this.#name = yield* Effect.tryPromise(() => state.storage.get("__liminal_name")).pipe(
            Effect.flatMap((v) => (typeof v === "string" ? decodeName(v) : Effect.succeed(undefined))),
          )
          for (const socket of state.getWebSockets()) {
            const attachments = yield* decodeAttachments(socket.deserializeAttachment())
            yield* this.directory.register(socket, attachments)
          }
        }).pipe(
          Effect.tapCause(logCause),
          span("make_runtime"),
          Layer.effectDiscard,
          Layer.provideMerge(baseLayer),
          boundLayer("actor"),
          ManagedRuntime.make,
        )
      }

      #name?: Name["Type"] | undefined
      fetch(request: Request): Promise<Response> {
        return Effect.gen({ self: this }, function* () {
          const url = new URL(request.url)
          const name = yield* decodeName(url.searchParams.get("__liminal_name"))
          const attachments = yield* decodeAttachmentsString(url.searchParams.get("__liminal_attachments"))
          if (!this.#name) {
            this.#name = name
            const state = yield* DoState.DoState
            const encoded = yield* S.encodeEffect(Name)(name)
            yield* Effect.promise(() => state.storage.put("__liminal_name", encoded))
          }
          const { 0: webSocket, 1: server } = new WebSocketPair()
          const state = yield* DoState.DoState
          state.acceptWebSocket(server)
          server.send(yield* encodeAuditionSuccess({ _tag: "Audition.Success" }))
          const currentClient = yield* this.directory.register(server, attachments)
          const ActorLive = Layer.succeed(actor, {
            name,
            clients: this.directory.handles,
            currentClient,
          })
          yield* onConnect.pipe(
            Effect.scoped,
            span("onConnect"),
            Effect.provide([ActorLive, runLayer.pipe(Layer.provideMerge(ActorLive))]),
          )
          return new Response(null, {
            status: 101,
            webSocket,
            headers: { [SecWebSocketProtocol]: "liminal" },
          })
        }).pipe(Effect.scoped, Effect.tapCause(logCause), span("fetch"), this.runtime.runPromise)
      }

      webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
        Effect.gen({ self: this }, function* () {
          const currentClient = yield* this.directory.get(socket)
          const name = yield* Effect.fromNullishOr(this.#name)
          const layer = Layer.succeed(actor, {
            name,
            clients: this.directory.handles,
            currentClient,
          })
          const message = yield* decodeClientM(raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : raw)
          yield* debug("MessageReceived", { message })
          if (message._tag === "Audition.Payload") {
            return yield* Effect.die(undefined)
          }
          if (message._tag === "Disconnect") {
            return yield* currentClient.disconnect
          }
          const { id, payload } = message
          const { _tag, value } = payload as never
          yield* handlers[_tag]!(value).pipe(
            Effect.provide(runLayer.pipe(Layer.provideMerge(layer))),
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
            span("handler", { attributes: { _tag } }),
            Effect.andThen((v) => Effect.sync(() => socket.send(v))),
            Effect.scoped,
          )
        }).pipe(Effect.scoped, Mutex.task, Effect.tapCause(logCause), span("webSocketMessage"), this.runtime.runFork)
      }

      webSocketClose(socket: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
        this.directory
          .unregister(socket)
          .pipe(Effect.tap(debug("SocketClosed")), Effect.tapCause(logCause), this.runtime.runFork)
      }

      webSocketError(socket: WebSocket, cause: unknown) {
        Effect.gen({ self: this }, function* () {
          yield* debug("SocketErrored", { cause })
          yield* this.directory.unregister(socket)
        }).pipe(Effect.tapCause(logCause), span("SocketErrored", { attributes: { cause } }), this.runtime.runFork)
      }
    }

    const upgrade = Effect.fnUntraced(function* (name: Name["Type"], attachments: (typeof Attachments)["Type"]) {
      yield* debug("UpgradeInitiated", { attachments })
      const namespace = yield* tag
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
      url.searchParams.set("__liminal_name", nameEncoded)
      url.searchParams.set("__liminal_attachments", yield* encodeAttachmentsString(attachments))
      return yield* Effect.promise(() => stub.fetch(new Request(url, request))).pipe(Effect.map(HttpServerResponse.raw))
    }, span("upgrade"))

    const layer = Binding.layer(tag, ["getByName"])

    return Object.assign(tag, { definition, upgrade, layer }) as never
  }
