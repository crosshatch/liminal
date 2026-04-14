import type { FieldsRecord } from "liminal/_types"

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
import { Protocol, type Actor, type Method } from "liminal"
import { SecWebSocketProtocol } from "liminal/_constants"
import * as Diagnostic from "liminal/_util/Diagnostic"
import * as Mutex from "liminal/_util/Mutex"

import * as Binding from "./Binding.ts"
import * as ClientDirectory from "./ClientDirectory.ts"
import { close } from "./close.ts"
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
  MethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
  PreludeROut,
  PreludeE,
  RunROut,
  RunE,
> {
  readonly binding: Binding_

  readonly actor: Actor.Actor<
    ActorSelf,
    ActorId,
    NameA,
    AttachmentFields,
    ClientSelf,
    ClientId,
    MethodDefinitions,
    EventDefinitions
  >

  readonly preludeLayer: Layer.Layer<PreludeROut, PreludeE>

  readonly runLayer: Layer.Layer<RunROut, RunE, ActorSelf | PreludeROut>

  readonly handlers: Method.Handlers<
    MethodDefinitions,
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
  MethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
  PreludeROut,
  PreludeE,
  RunROut,
  RunE,
> extends Binding.Binding<RegistrySelf, RegistryId, Binding_, DurableObjectNamespace, never, never, never> {
  new (state: DurableObjectState<{}>): Context.ServiceClass.Shape<RegistryId, DurableObjectNamespace>

  readonly [TypeId]: typeof TypeId

  readonly definition: ActorRegistryDefinition<
    Binding_,
    ActorSelf,
    ActorId,
    NameA,
    AttachmentFields,
    ClientSelf,
    ClientId,
    MethodDefinitions,
    EventDefinitions,
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
    MethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
    EventDefinitions extends FieldsRecord,
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
      MethodDefinitions,
      EventDefinitions,
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
    MethodDefinitions,
    EventDefinitions,
    PreludeROut,
    PreludeE,
    RunROut,
    RunE
  > => {
    const { hibernation, actor, preludeLayer, runLayer, handlers, binding, onConnect } = definition
    const {
      definition: {
        name: Name,
        client: { schema, key: clientId },
      },
      schema: { attachments: Attachments },
    } = actor

    const Params = S.StringFromBase64Url.pipe(
      S.decodeTo(
        S.fromJsonString(
          S.Struct({
            name: Name,
            attachments: Attachments,
          }),
        ),
      ),
    )

    class tag extends Binding.Service<RegistrySelf>()(
      id,
      binding,
      (value): value is DurableObjectNamespace => "getByName" in value,
    ) {
      readonly state
      readonly runtime
      readonly directory = ClientDirectory.make(actor)

      constructor(state: DurableObjectState<{}>, env: unknown) {
        // @ts-ignore
        super(state, env)

        this.state = state
        if (hibernation) {
          const hibernationDuration = Duration.fromInput(hibernation)
          if (Option.isSome(hibernationDuration)) {
            state.setHibernatableWebSocketEventTimeout(Duration.toMillis(hibernationDuration.value))
          }
        }

        this.runtime = Effect.gen({ self: this }, function* () {
          this.#name = yield* Effect.tryPromise(() => this.state.storage.get("__liminal_name")).pipe(
            Effect.flatMap((v) => (typeof v === "string" ? S.decodeEffect(Name)(v) : Effect.succeed(undefined))),
          )
          for (const socket of this.state.getWebSockets()) {
            const attachments = yield* S.decodeUnknownEffect(Attachments)(socket.deserializeAttachment())
            yield* this.directory.register(socket, attachments)
          }
          return Layer.mergeAll(
            preludeLayer.pipe(Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))),
            Intrinsic.layer,
            Mutex.layer,
          )
        }).pipe(Layer.unwrap, ManagedRuntime.make)
      }

      #name?: NameA | undefined
      fetch(request: Request): Promise<Response> {
        return Effect.gen({ self: this }, function* () {
          const url = new URL(request.url)
          const { name, attachments } = yield* S.decodeUnknownEffect(Params)(url.searchParams.get("__liminal"))
          if (!this.#name) {
            this.#name = name
            const encoded = yield* S.encodeEffect(Name)(name)
            yield* Effect.promise(() => this.state.storage.put("__liminal_name", encoded))
          }
          const { 0: webSocket, 1: server } = new WebSocketPair()
          this.state.acceptWebSocket(server)
          server.send(yield* S.encodeEffect(S.fromJsonString(Protocol.Audition.Success))({ _tag: "Audition.Success" }))
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
        }).pipe(Effect.scoped, span("fetch"), this.runtime.runPromise)
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
          const message = yield* S.decodeUnknownEffect(S.fromJsonString(schema.call.payload))(
            raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : raw,
          )
          yield* debug("MessageReceived", { message })
          const { id, payload } = message
          const { _tag, value } = payload
          yield* handlers[_tag](value).pipe(
            Effect.provide(runLayer.pipe(Layer.provideMerge(layer))),
            Effect.matchEffect({
              onSuccess: (value) =>
                S.encodeEffect(S.fromJsonString(schema.call.success))({
                  _tag: "Call.Success",
                  id,
                  value: { _tag, value },
                }),
              onFailure: (value) =>
                S.encodeEffect(S.fromJsonString(schema.call.failure))({
                  _tag: "Call.Failure",
                  id,
                  cause: { _tag, value },
                }),
            }),
            span("handler", { attributes: { _tag } }),
            Effect.andThen((v) => Effect.sync(() => socket.send(v))),
            Effect.scoped,
          )
        }).pipe(Effect.scoped, Mutex.task, span("webSocketMessage"), this.runtime.runFork)
      }

      webSocketClose(socket: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
        this.directory.unregister(socket).pipe(this.runtime.runFork)
      }

      webSocketError(socket: WebSocket, cause: unknown) {
        Effect.gen({ self: this }, function* () {
          yield* debug("SocketErrored", { cause })
          yield* this.directory.unregister(socket)
        }).pipe(span("webSocketError", { attributes: { cause } }), this.runtime.runFork)
      }
    }

    const upgrade = Effect.fnUntraced(function* (name: NameA, attachments: S.Struct<AttachmentFields>["Type"]) {
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
        return close(
          4003,
          yield* S.encodeEffect(S.fromJsonString(Protocol.Audition.Failure))(
            Protocol.Audition.Failure.make({
              expected: clientId,
              actual: requestClientId,
            }),
          ),
        )
      }
      const url = new URL(request.url)
      const params = yield* S.encodeEffect(Params)({ name, attachments })
      url.searchParams.set("__liminal", params)
      return yield* Effect.promise(() => stub.fetch(new Request(url, request))).pipe(
        Effect.map((v) => HttpServerResponse.raw(v)),
      )
    }, span("upgrade"))

    return Object.assign(tag, { [TypeId]: TypeId, definition, upgrade }) as never
  }
