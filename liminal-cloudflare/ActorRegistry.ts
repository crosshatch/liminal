import type { Actor, Method } from "liminal"
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
  Schema,
  Option,
} from "effect"
import { HttpServerResponse } from "effect/unstable/http"
import { SecWebSocketProtocol } from "liminal/_constants"
import { boundLayer } from "liminal/_util/boundLayer"
import * as Diagnostic from "liminal/_util/Diagnostic"
import { logCause } from "liminal/_util/logCause"
import * as Mutex from "liminal/_util/Mutex"

import * as Binding from "./Binding.ts"
import * as ClientDirectory from "./ClientDirectory.ts"
import { close } from "./close.ts"
import { DurableObjectState } from "./DurableObjectState.ts"
import * as Intrinsic from "./Intrinsic.ts"
import { NativeRequest } from "./NativeRequest.ts"

const { debug, span } = Diagnostic.module("cloudflare.ActorRegistry")

const TypeId = "~liminal/cloudflare/ActorRegistry" as const

export interface ActorRegistryDefinition<
  Binding_ extends string,
  ActorSelf,
  ActorId extends string,
  NameA,
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

  readonly binding: Binding_

  readonly actor: Actor.Actor<ActorSelf, ActorId, NameA, AttachmentFields, ClientSelf, ClientId, D>

  readonly preludeLayer: Layer.Layer<
    | PreludeROut
    | NonNullable<this[""]>["F"]["Payload"]["DecodingServices"]
    | NonNullable<this[""]>["F"]["Success"]["EncodingServices"]
    | NonNullable<this[""]>["F"]["Failure"]["EncodingServices"]
    | NonNullable<this[""]>["Event"]["EncodingServices"]
    | S.Struct<AttachmentFields>["DecodingServices"]
    | S.Struct<AttachmentFields>["EncodingServices"],
    PreludeE
  >

  readonly runLayer: Layer.Layer<RunROut, RunE, ActorSelf | PreludeROut>

  readonly handlers: Method.Handlers<
    D["methods"],
    ActorSelf | RunROut | Intrinsic.Intrinsic | PreludeROut | Scope.Scope
  >

  readonly onConnect: Effect.Effect<void, never, ActorSelf | RunROut | Intrinsic.Intrinsic | PreludeROut | Scope.Scope>

  readonly hibernation?: Duration.Input | undefined
}

export interface ActorRegistry<
  RegistrySelf,
  RegistryId extends string,
  Binding_ extends string,
  ActorSelf,
  ActorId extends string,
  NameA,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
  PreludeROut,
  PreludeE,
  RunROut,
  RunE,
> extends Binding.Binding<RegistrySelf, RegistryId, Binding_, DurableObjectNamespace, never, never, never> {
  new (state: globalThis.DurableObjectState<{}>): Context.ServiceClass.Shape<RegistryId, DurableObjectNamespace>

  readonly [TypeId]: typeof TypeId

  readonly definition: ActorRegistryDefinition<
    Binding_,
    ActorSelf,
    ActorId,
    NameA,
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
    name: NameA,
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse, Schema.SchemaError, RegistrySelf | NativeRequest>
}

export const Service =
  <RegistrySelf>() =>
  <
    RegistryId extends string,
    Binding_ extends string,
    ActorSelf,
    ActorId extends string,
    NameA,
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
      Binding_,
      ActorSelf,
      ActorId,
      NameA,
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
    Binding_,
    ActorSelf,
    ActorId,
    NameA,
    AttachmentFields,
    ClientSelf,
    ClientId,
    D,
    PreludeROut,
    PreludeE,
    RunROut,
    RunE
  > => {
    const { hibernation, actor, preludeLayer, runLayer, handlers, binding, onConnect } = definition
    const {
      definition: {
        name: Name,
        client: { protocol, key: clientId },
      },
      protocol: { Attachments },
    } = actor

    const Params = S.StringFromBase64Url.pipe(
      S.decodeTo(
        S.fromJsonString(
          S.toCodecJson(
            S.Struct({
              name: Name,
              attachments: Attachments,
            }),
          ),
        ),
      ),
    )

    class tag extends Binding.Service<RegistrySelf>()(
      id,
      binding,
      (value): value is DurableObjectNamespace => "getByName" in value,
    ) {
      readonly runtime
      readonly directory = ClientDirectory.make(actor)

      constructor(state: globalThis.DurableObjectState<{}>, env: unknown) {
        // @ts-ignore
        super(state, env)

        if (hibernation) {
          Option.andThen(
            Duration.fromInput(hibernation),
            flow(Duration.toMillis, state.setHibernatableWebSocketEventTimeout),
          )
        }

        const baseLayer = Layer.mergeAll(
          preludeLayer.pipe(Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))),
          Intrinsic.layer,
          Layer.succeed(DurableObjectState, state),
          Mutex.layer,
        )

        this.runtime = Effect.gen({ self: this }, function* () {
          this.#name = yield* Effect.tryPromise(() => state.storage.get("__liminal_name")).pipe(
            Effect.flatMap((v) => (typeof v === "string" ? S.decodeEffect(Name)(v) : Effect.succeed(undefined))),
          )
          for (const socket of state.getWebSockets()) {
            const attachments = yield* S.decodeUnknownEffect(S.fromJsonString(S.toCodecJson(Attachments)))(
              socket.deserializeAttachment(),
            )
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

      #name?: NameA | undefined
      fetch(request: Request): Promise<Response> {
        return Effect.gen({ self: this }, function* () {
          const url = new URL(request.url)
          const { name, attachments } = yield* S.decodeUnknownEffect(Params)(url.searchParams.get("__liminal"))
          if (!this.#name) {
            this.#name = name
            const state = yield* DurableObjectState
            const encoded = yield* S.encodeEffect(Name)(name)
            yield* Effect.promise(() => state.storage.put("__liminal_name", encoded))
          }
          const { 0: webSocket, 1: server } = new WebSocketPair()
          const state = yield* DurableObjectState
          state.acceptWebSocket(server)
          server.send(
            yield* S.encodeEffect(S.fromJsonString(S.toCodecJson(protocol.Audition.Success)))({
              _tag: "Audition.Success",
            }),
          )
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
          const message = yield* S.decodeUnknownEffect(S.fromJsonString(S.toCodecJson(protocol.F.Payload)))(
            raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : raw,
          )
          yield* debug("MessageReceived", { message })
          const { id, payload } = message
          const { _tag, value } = payload as never
          yield* handlers[_tag]!(value).pipe(
            Effect.provide(runLayer.pipe(Layer.provideMerge(layer))),
            Effect.matchEffect({
              onSuccess: (value) =>
                S.encodeEffect(S.fromJsonString(S.toCodecJson(protocol.F.Success)))({
                  _tag: "F.Success",
                  id,
                  success: { _tag, value } as never,
                }),
              onFailure: (value) =>
                S.encodeEffect(S.fromJsonString(S.toCodecJson(protocol.F.Failure)))({
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

    const upgrade = Effect.fnUntraced(function* (name: NameA, attachments: S.Struct<AttachmentFields>["Type"]) {
      yield* debug("UpgradeInitiated", { attachments })
      const namespace = yield* tag
      const nameEncoded = yield* S.encodeEffect(Name)(name)
      const stub = namespace.getByName(nameEncoded)
      const request = yield* NativeRequest
      const protocols = yield* Effect.fromNullishOr(request.headers.get(SecWebSocketProtocol)).pipe(
        Effect.map(flow(String.split(","), Array.map(String.trim))),
      )
      const liminalTokenI = yield* Array.findFirstIndex(protocols, (v) => v === "liminal")
      const requestClientId = yield* Effect.fromNullishOr(protocols[liminalTokenI + 1]).pipe(
        Effect.flatMap((v) => Encoding.decodeBase64UrlString(v).asEffect()),
      )
      if (requestClientId !== clientId) {
        return yield* S.encodeEffect(S.fromJsonString(S.toCodecJson(protocol.Audition.Failure)))({
          _tag: "Audition.Failure",
          client: clientId,
          routed: requestClientId,
        }).pipe(Effect.andThen((v) => Effect.sync(() => close(v))))
      }
      const url = new URL(request.url)
      const params = yield* S.encodeEffect(Params)({ name, attachments })
      url.searchParams.set("__liminal", params)
      return yield* Effect.promise(() => stub.fetch(new Request(url, request))).pipe(Effect.map(HttpServerResponse.raw))
    }, span("upgrade"))

    return Object.assign(tag, { [TypeId]: TypeId, definition, upgrade }) as never
  }
