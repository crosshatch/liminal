import type { TopFromString } from "liminal/_util/schema"
import type { ProtocolDefinition } from "liminal/Protocol"

import { Cause, Effect, Exit, Layer, Option, Ref, Schema as S, Scope, Semaphore, Stream } from "effect"
import { type Actor, type ClientHandle, type Method, ClientDirectory, type ActorTransport } from "liminal"
import * as Diagnostic from "liminal/_util/Diagnostic"
import { logCause } from "liminal/_util/logCause"

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
}) {
  const {
    definition: {
      client: {
        protocol: { F, Client: ClientM, Audition },
        key: expectedKey,
      },
      name: Name,
    },
  } = actor

  const validateClientMessage = S.decodeUnknownEffect(S.toType(ClientM))
  const encodeName = S.encodeEffect(Name)

  interface Entry {
    readonly directory: ClientDirectory.ClientDirectory<MessagePort, ActorSelf, AttachmentFields, D>
    readonly mutex: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  }

  const entries: Record<string, Entry> = {}

  const transport: ActorTransport<MessagePort, AttachmentFields, D> = {
    send: (port, event) => Effect.sync(() => port.postMessage(event)),
    close: (port) => Effect.sync(() => port.close()),
    snapshot: () => Effect.void,
  }

  const getEntry = Effect.fnUntraced(function* (key: string) {
    const existing = entries[key]
    if (existing) return existing
    const directory = ClientDirectory.make(actor, transport)
    const semaphore = yield* Semaphore.make(1)
    const fresh = {
      directory,
      mutex: semaphore.withPermits(1),
    }
    entries[key] = fresh
    return fresh
  })

  const outerScope = yield* Scope.Scope

  yield* introductions.pipe(
    Stream.runForEach(({ name, port, attachments }) =>
      Effect.gen(function* () {
        yield* debug("IntroductionReceived", { name })

        const stateRef = yield* Ref.make<
          Option.Option<{
            readonly key: string
            readonly entry: Entry
            readonly currentClient: ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>
            readonly ActorLive: Layer.Layer<ActorSelf>
          }>
        >(Option.none())

        const scope = yield* Scope.fork(outerScope, "sequential")
        const closeScope = Scope.close(scope, Exit.void)

        yield* Scope.addFinalizer(
          scope,
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            if (Option.isSome(state)) {
              const {
                key,
                entry: { directory },
              } = state.value
              yield* directory.unregister(port)
              if (directory.handles.size === 0) {
                delete entries[key]
              }
            }
            yield* transport.close(port)
          }),
        )

        const forkScoped = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
          effect.pipe(
            Effect.catchCause((cause) =>
              Cause.hasInterruptsOnly(cause) ? Effect.void : logCause(cause).pipe(Effect.andThen(closeScope)),
            ),
            Effect.forkScoped,
            Scope.provide(scope),
          )

        yield* forkScoped(
          Stream.fromEventListener<MessageEvent>(port, "message").pipe(
            Stream.runForEach(
              Effect.fnUntraced(function* (e) {
                const state = yield* Ref.get(stateRef)
                yield* Effect.gen(function* () {
                  const message = yield* validateClientMessage(e.data)
                  yield* debug("MessageReceived", { message })
                  if (Option.isNone(state)) {
                    if (message._tag !== "Audition.Payload") {
                      return yield* Effect.die(undefined)
                    }
                    const { client } = message
                    if (client !== expectedKey) {
                      port.postMessage({
                        _tag: "Audition.Failure",
                        client,
                        routed: expectedKey,
                      } satisfies typeof Audition.Failure.Type)
                      return yield* closeScope
                    }
                    const key = yield* encodeName(name)
                    const entry = yield* getEntry(key)
                    const currentClient = Object.assign(yield* entry.directory.register(port, attachments), {
                      disconnect: closeScope,
                    })
                    const ActorLive = Layer.succeed(actor, {
                      name,
                      clients: entry.directory.handles,
                      currentClient,
                    })
                    yield* Ref.set(stateRef, Option.some({ key, entry, currentClient, ActorLive }))
                    port.postMessage({ _tag: "Audition.Success" } satisfies typeof Audition.Success.Type)
                    return yield* onConnect.pipe(Effect.scoped, span("onConnect"), Effect.provide(ActorLive))
                  }
                  const { entry, ActorLive } = state.value
                  if (message._tag === "Audition.Payload") {
                    return yield* Effect.die(undefined)
                  }
                  if (message._tag === "Disconnect") {
                    return yield* closeScope
                  }
                  const { id, payload } = message
                  const { _tag, value } = payload as never
                  yield* handlers[_tag]!(value).pipe(
                    Effect.match({
                      onSuccess: (value) =>
                        ({
                          _tag: "F.Success",
                          id,
                          success: { _tag, value } as never,
                        }) satisfies typeof F.Success.Type,
                      onFailure: (value) =>
                        ({
                          _tag: "F.Failure",
                          id,
                          failure: { _tag, value } as never,
                        }) satisfies typeof F.Failure.Type,
                    }),
                    Effect.andThen((v) => Effect.sync(() => port.postMessage(v))),
                    span("handler", { attributes: { _tag } }),
                    Effect.scoped,
                    Effect.provide(ActorLive),
                    entry.mutex,
                  )
                })
              }, span("message")),
            ),
          ),
        )

        yield* forkScoped(
          Stream.fromEventListener<MessageEvent>(port, "messageerror").pipe(
            Stream.runForEach((cause) => debug("PortErrored", { cause }).pipe(Effect.andThen(closeScope))),
          ),
        )

        port.start()
      }).pipe(Effect.catchCause((cause) => (Cause.hasInterruptsOnly(cause) ? Effect.void : logCause(cause)))),
    ),
  )
}, span("make"))
