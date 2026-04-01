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
import * as Mutex from "liminal/_util/Mutex"

import * as Binding from "./Binding.ts"
import * as ClientDirectory from "./ClientDirectory.ts"
import * as Intrinsic from "./Intrinsic.ts"
import { NativeRequest } from "./NativeRequest.ts"

export const SecWebSocketProtocol = "Sec-WebSocket-Protocol" as const

const extractProtocol = Effect.fnUntraced(function* (headers: Headers) {
  const protocols = yield* Effect.fromNullable(headers.get(SecWebSocketProtocol)).pipe(
    Effect.map(flow(String.split(","), Array.map(String.trim))),
  )
  const liminalProtocolI = yield* Array.findFirstIndex(protocols, (v) => v === "liminal")
  return yield* Effect.fromNullable(protocols[liminalProtocolI + 1]).pipe(
    Effect.flatMap(Encoding.decodeBase64UrlString),
  )
})

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
  HandlerROut,
  HandlerE,
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

  readonly requestLayer: Layer.Layer<HandlerROut, HandlerE, ActorSelf | PreludeROut>

  readonly handlers: Method.Handlers<
    MethodDefinitions,
    ActorSelf | HandlerROut | Intrinsic.Intrinsic | PreludeROut | Scope.Scope
  >

  readonly onConnect: Effect.Effect<
    void,
    never,
    ActorSelf | HandlerROut | Intrinsic.Intrinsic | PreludeROut | Scope.Scope
  >

  readonly hibernation?: Duration.DurationInput | undefined

  readonly disableLogging?: boolean
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
  HandlerROut,
  HandlerE,
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
    HandlerROut,
    HandlerE
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
    HandlerROut,
    HandlerE,
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
      HandlerROut,
      HandlerE
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
    HandlerROut,
    HandlerE
  > => {
    const { hibernation, actor, preludeLayer, requestLayer, handlers, binding, onConnect, disableLogging } = definition
    const {
      definition: { name: nameSchema, client },
      schema,
    } = actor

    const paramsSchema = S.compose(
      S.StringFromBase64Url,
      S.parseJson(
        S.Struct({
          name: nameSchema,
          attachments: schema.attachments,
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
            Effect.flatMap((v) =>
              typeof v === "string" ? S.decode(actor.definition.name)(v) : Effect.succeed(undefined),
            ),
          )
          for (const socket of this.state.getWebSockets()) {
            const attachments = yield* S.decodeUnknown(schema.attachments)(socket.deserializeAttachment())
            yield* this.directory.register(socket, attachments)
          }
          return Layer.mergeAll(
            preludeLayer,
            Intrinsic.layer,
            Layer.setConfigProvider(ConfigProvider.fromJson(env)),
            Mutex.layer,
          )
        }).pipe(Layer.unwrapEffect, ManagedRuntime.make)
      }

      #name?: NameA | undefined
      fetch(request: Request): Promise<Response> {
        return Effect.gen(this, function* () {
          const url = new URL(request.url)
          const { name, attachments } = yield* S.decodeUnknown(paramsSchema)(url.searchParams.get("__liminal"))
          if (!this.#name) {
            this.#name = name
            const encoded = yield* S.encode(nameSchema)(name)
            yield* Effect.promise(() => this.state.storage.put("__liminal_name", encoded))
          }
          const { 0: webSocket, 1: server } = new WebSocketPair()
          this.state.acceptWebSocket(server)
          server.send(
            yield* S.encode(S.parseJson(Protocol.AuditionSuccessMessage))({
              _tag: "AuditionSucceeded",
            }),
          )
          const caller = yield* this.directory.register(server, attachments)
          const ActorLive = Layer.succeed(actor, {
            name,
            clients: this.directory.handles,
            currentClient: caller,
          })
          yield* onConnect.pipe(
            Effect.scoped,
            Effect.provide([ActorLive, requestLayer.pipe(Layer.provideMerge(ActorLive))]),
          )
          yield* this.directory.flush
          return new Response(null, {
            status: 101,
            webSocket,
            headers: { [SecWebSocketProtocol]: "liminal" },
          })
        }).pipe(this.runtime.runPromise)
      }

      webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
        Effect.gen(this, function* () {
          yield* Effect.addFinalizer(() => this.directory.flush)
          const caller = yield* this.directory.get(socket)
          const name = yield* Effect.fromNullable(this.#name)
          const layer = Layer.succeed(actor, {
            name,
            clients: this.directory.handles,
            currentClient: caller,
          })
          const message = yield* S.decodeUnknown(S.parseJson(client.schema.call))(
            raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : raw,
          )
          if (disableLogging === undefined || !disableLogging) {
            yield* Effect.log(message)
          }
          const { id, payload } = message
          const { _tag, value } = payload
          yield* handlers[_tag](value).pipe(
            Effect.provide(requestLayer.pipe(Layer.provideMerge(layer))),
            Effect.matchEffect({
              onSuccess: (value) =>
                S.encode(S.parseJson(client.schema.success))({
                  _tag: "Success",
                  id,
                  value: { _tag, value },
                }),
              onFailure: (value) =>
                S.encode(S.parseJson(client.schema.failure))({
                  _tag: "Failure",
                  id,
                  cause: { _tag, value },
                }),
            }),
            Effect.andThen((v) => Effect.sync(() => socket.send(v))),
          )
          yield* this.directory.flush
        }).pipe(Mutex.task, Effect.scoped, this.runtime.runFork)
      }

      webSocketClose(socket: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
        this.directory.unregister(socket).pipe(this.runtime.runFork)
      }

      webSocketError(socket: WebSocket, cause: unknown) {
        this.directory.unregister(socket).pipe(
          Effect.andThen(() => Effect.fail(cause)),
          this.runtime.runFork,
        )
      }
    }

    const upgrade = Effect.fnUntraced(function* (name: NameA, attachments: S.Struct<AttachmentFields>["Type"]) {
      const namespace = yield* tag
      const nameEncoded = yield* S.encode(nameSchema)(name)
      const stub = namespace.getByName(nameEncoded)
      const request = yield* NativeRequest
      const actual = yield* extractProtocol(request.headers)
      const expected = client.key
      if (actual !== expected) {
        const { 0: client, 1: server } = new WebSocketPair()
        server.accept()
        server.close(
          4003,
          yield* S.encode(S.parseJson(Protocol.AuditionFailureMessage))(
            Protocol.AuditionFailureMessage.make({ expected, actual }),
          ),
        )
        return yield* HttpServerResponse.raw(
          new Response(null, {
            status: 101,
            webSocket: client,
            headers: { [SecWebSocketProtocol]: "liminal" },
          }),
        )
      }
      const url = new URL(request.url)
      const params = yield* S.encode(paramsSchema)({ name, attachments })
      url.searchParams.set("__liminal", params)
      return yield* Effect.promise(() => stub.fetch(new Request(url, request))).pipe(
        Effect.map((v) => HttpServerResponse.raw(v)),
      )
    })

    return Object.assign(tag, { [TypeId]: TypeId, definition, upgrade }) as never
  }
