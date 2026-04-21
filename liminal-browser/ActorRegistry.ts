import type { TopFromString } from "liminal/_util/schema"
import type { ProtocolDefinition } from "liminal/Protocol"

import { Effect, Layer, Option, Ref, Schema as S, Scope, Semaphore, Stream } from "effect"
import { type Actor, type ClientHandle, type Method, ClientDirectory } from "liminal"
import * as Diagnostic from "liminal/_util/Diagnostic"
import { logCause } from "liminal/_util/logCause"

import { transport } from "./transport.ts"

const { debug, span } = Diagnostic.module("browser.ActorRegistry")

export interface Introduction<Name extends TopFromString, AttachmentFields extends S.Struct.Fields> {
  readonly port: MessagePort
  readonly name: Name["Type"]
  readonly attachments: S.Struct<AttachmentFields>["Type"]
}

export const make = Effect.fnUntraced(function* <
  ActorSelf,
  ActorId extends string,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends ProtocolDefinition,
  HandlerR,
  const Handlers extends Method.Handlers<D["methods"], HandlerR>,
  A,
  E,
  R,
  IntroductionE,
  IntroductionR,
>({
  actor,
  handlers,
  onConnect,
  introductions,
}: {
  readonly actor: Actor.Actor<ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D>
  readonly handlers: Handlers
  readonly onConnect: Effect.Effect<A, E, R>
  readonly introductions: Stream.Stream<Introduction<Name, AttachmentFields>, IntroductionE, IntroductionR>
}): Effect.fn.Return<
  void,
  IntroductionE,
  Scope.Scope | S.Struct<AttachmentFields>["EncodingServices"] | IntroductionR
> {
  const { transcoders } = actor

  interface Entry {
    readonly directory: ClientDirectory.ClientDirectory<MessagePort, ActorSelf, AttachmentFields, D>
    readonly mutex: <A1, E1, R1>(effect: Effect.Effect<A1, E1, R1>) => Effect.Effect<A1, E1, R1>
  }
  const entries: Record<string, Entry> = {}

  const getEntry = Effect.fnUntraced(function* (name: Name["Type"]) {
    const key = yield* transcoders.encodeName(name)
    const existing = entries[key]
    if (existing) return existing
    const directory = ClientDirectory.make(transport, actor)
    const semaphore = yield* Semaphore.make(1)
    const fresh = { directory, mutex: semaphore.withPermits(1) }
    entries[key] = fresh
    return fresh
  })

  const expectedKey = actor.definition.client.key

  yield* introductions.pipe(
    Stream.runForEach(
      Effect.fnUntraced(function* ({ port, name, attachments }) {
        yield* debug("IntroductionReceived", { name })
        const readyRef = yield* Ref.make<
          Option.Option<{
            readonly entry: Entry
            readonly currentClient: ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>
            readonly ActorLive: Layer.Layer<ActorSelf>
          }>
        >(Option.none())

        yield* Stream.fromEventListener<MessageEvent>(port, "message").pipe(
          Stream.runForEach(
            Effect.fnUntraced(
              function* (e) {
                const state = yield* Ref.get(readyRef)
                if (Option.isNone(state)) {
                  if (e.data !== expectedKey) {
                    yield* debug("AuditionFailed", { routed: e.data })
                    yield* transcoders
                      .encodeAuditionFailure({
                        _tag: "Audition.Failure",
                        client: expectedKey,
                        routed: typeof e.data === "string" ? e.data : String(e.data),
                      })
                      .pipe(
                        Effect.andThen((v) =>
                          Effect.sync(() => {
                            port.postMessage(v)
                            port.close()
                          }),
                        ),
                      )
                    return
                  }
                  const entry = yield* getEntry(name)
                  const currentClient = yield* entry.directory.register(port, attachments)
                  const ActorLive = Layer.succeed(actor, {
                    name,
                    clients: entry.directory.handles,
                    currentClient,
                  })
                  yield* transcoders
                    .encodeAuditionSuccess({ _tag: "Audition.Success" })
                    .pipe(Effect.andThen((v) => Effect.sync(() => port.postMessage(v))))
                  yield* onConnect.pipe(Effect.scoped, span("onConnect"), Effect.provide(ActorLive))
                  yield* Ref.set(readyRef, Option.some({ entry, currentClient, ActorLive }))
                  return
                }
                const { entry, ActorLive } = state.value
                yield* Effect.gen(function* () {
                  const message = yield* transcoders.decodeFPayload(e.data)
                  yield* debug("MessageReceived", { message })
                  const { id, payload } = message
                  const { _tag, value } = payload as never
                  yield* handlers[_tag]!(value).pipe(
                    Effect.matchEffect({
                      onSuccess: (value) =>
                        transcoders.encodeFSuccess({
                          _tag: "F.Success",
                          id,
                          success: { _tag, value } as never,
                        }),
                      onFailure: (value) =>
                        transcoders.encodeFFailure({
                          _tag: "F.Failure",
                          id,
                          failure: { _tag, value } as never,
                        }),
                    }),
                    span("handler", { attributes: { _tag } }),
                    Effect.andThen((v) => Effect.sync(() => port.postMessage(v))),
                    Effect.scoped,
                    Effect.provide(ActorLive),
                  )
                }).pipe(entry.mutex)
              },
              Effect.tapCause(logCause),
              span("message"),
            ),
          ),
          Effect.forkScoped,
        )
        yield* Stream.fromEventListener<MessageEvent>(port, "messageerror").pipe(
          Stream.runForEach(
            Effect.fnUntraced(function* (cause) {
              yield* debug("PortErrored", { cause })
              const state = yield* Ref.get(readyRef)
              if (Option.isSome(state)) {
                yield* state.value.entry.directory.unregister(port)
              }
            }),
          ),
          Effect.forkScoped,
        )
        port.start()
      }),
    ),
  )
}, span("make"))
