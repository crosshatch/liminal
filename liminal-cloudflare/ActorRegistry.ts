import type { Fields, FieldsRecord } from "liminal/_types"

import { HttpServerResponse } from "@effect/platform"
import {
  Layer,
  Effect,
  Scope,
  Schema as S,
  ParseResult,
  Context,
  ManagedRuntime,
  ConfigProvider,
  Duration,
  flow,
  String,
  Array,
  Encoding,
} from "effect"
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
  AttachmentFields extends Fields,
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

  readonly hibernation?: Duration.DurationInput | undefined
}

export interface ActorRegistry<
  RegistrySelf,
  RegistryId extends string,
  Binding_ extends string,
  ActorSelf,
  ActorId extends string,
  NameA,
  AttachmentFields extends Fields,
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
  PreludeROut,
  PreludeE,
  RunROut,
  RunE,
> extends Binding.Binding<RegistrySelf, RegistryId, Binding_, DurableObjectNamespace> {
  new (state: DurableObjectState<{}>): Context.TagClassShape<RegistryId, DurableObjectNamespace>

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
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse, ParseResult.ParseError, RegistrySelf | NativeRequest>
}

export const Service =
  <RegistrySelf>() =>
  <
    RegistryId extends string,
    Binding_ extends string,
    ActorSelf,
    ActorId extends string,
    NameA,
    AttachmentFields extends Fields,
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

    const Params = S.compose(
      S.StringFromBase64Url,
      S.parseJson(
        S.Struct({
          name: Name,
          attachments: Attachments,
        }),
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
          state.setHibernatableWebSocketEventTimeout(Duration.toMillis(hibernation))
        }

        this.runtime = Effect.gen(this, function* () {
          this.#name = yield* Effect.tryPromise(() => this.state.storage.get("__liminal_name")).pipe(
            Effect.flatMap(S.decodeUnknown(Name)),
          )
          for (const socket of this.state.getWebSockets()) {
            const attachments = yield* S.decodeUnknown(Attachments)(socket.deserializeAttachment())
            yield* this.directory.register(socket, attachments)
          }
          return Layer.mergeAll(
            preludeLayer.pipe(Layer.provideMerge(Layer.setConfigProvider(ConfigProvider.fromJson(env)))),
            Intrinsic.layer,
            Mutex.layer,
          )
        }).pipe(Layer.unwrapEffect, ManagedRuntime.make)
      }

      #name?: NameA | undefined
      fetch(request: Request): Promise<Response> {
        return Effect.gen(this, function* () {
          const url = new URL(request.url)
          const { name, attachments } = yield* S.decodeUnknown(Params)(url.searchParams.get("__liminal"))
          if (!this.#name) {
            this.#name = name
            const encoded = yield* S.encode(Name)(name)
            yield* Effect.promise(() => this.state.storage.put("__liminal_name", encoded))
          }
          const { 0: webSocket, 1: server } = new WebSocketPair()
          this.state.acceptWebSocket(server)
          server.send(
            yield* S.encode(S.parseJson(Protocol.Audition.Success))({
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
        }).pipe(Effect.scoped, span("fetch"), this.runtime.runPromise)
      }

      webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
        Effect.gen(this, function* () {
          const currentClient = yield* this.directory.get(socket)
          const name = yield* Effect.fromNullable(this.#name)
          const layer = Layer.succeed(actor, {
            name,
            clients: this.directory.handles,
            currentClient,
          })
          const message = yield* S.decodeUnknown(S.parseJson(schema.call.payload))(
            raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : raw,
          )
          yield* debug("MessageReceived", { message })
          const { id, payload } = message
          const { _tag, value } = payload
          yield* handlers[_tag](value).pipe(
            Effect.provide(runLayer.pipe(Layer.provideMerge(layer))),
            Effect.matchEffect({
              onSuccess: (value) =>
                S.encode(S.parseJson(schema.call.success))({
                  _tag: "Call.Success",
                  id,
                  value: { _tag, value },
                }),
              onFailure: (value) =>
                S.encode(S.parseJson(schema.call.failure))({
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
        Effect.gen(this, function* () {
          yield* debug("SocketErrored", { cause })
          yield* this.directory.unregister(socket)
        }).pipe(span("webSocketError", { attributes: { cause } }), this.runtime.runFork)
      }
    }

    const upgrade = Effect.fnUntraced(function* (name: NameA, attachments: S.Struct<AttachmentFields>["Type"]) {
      const namespace = yield* tag
      const nameEncoded = yield* S.encode(Name)(name)
      const stub = namespace.getByName(nameEncoded)
      const request = yield* NativeRequest
      const protocols = yield* Effect.fromNullable(request.headers.get(SecWebSocketProtocol)).pipe(
        Effect.map(flow(String.split(","), Array.map(String.trim))),
      )
      const liminalTokenI = yield* Array.findFirstIndex(protocols, (v) => v === "liminal")
      const requestClientId = yield* Effect.fromNullable(protocols[liminalTokenI + 1]).pipe(
        Effect.flatMap(Encoding.decodeBase64UrlString),
      )
      if (requestClientId !== clientId) {
        return yield* close(
          4003,
          yield* S.encode(S.parseJson(Protocol.Audition.Failure))(
            Protocol.Audition.Failure.make({
              expected: clientId,
              actual: requestClientId,
            }),
          ),
        )
      }
      const url = new URL(request.url)
      const params = yield* S.encode(Params)({ name, attachments })
      url.searchParams.set("__liminal", params)
      return yield* Effect.promise(() => stub.fetch(new Request(url, request))).pipe(
        Effect.map((v) => HttpServerResponse.raw(v)),
      )
    }, span("upgrade"))

    return Object.assign(tag, { [TypeId]: TypeId, definition, upgrade }) as never
  }
