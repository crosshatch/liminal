import type { TopFromString } from "liminal/_util/schema"
import type { ProtocolDefinition } from "liminal/Protocol"

import { Effect, Exit, Layer, Option, Ref, Schema as S, Scope, Semaphore, Stream } from "effect"
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
        protocol: { Audition, F },
      },
      name: Name,
    },
  } = actor

  const validateFPayload = S.decodeUnknownEffect(S.toType(F.Payload))
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
    const fresh = { directory, mutex: semaphore.withPermits(1) }
    entries[key] = fresh
    return fresh
  })

  const expectedKey = actor.definition.client.key

  const outerScope = yield* Scope.Scope

  yield* introductions.pipe(
    Stream.runForEach(
      Effect.fnUntraced(function* ({ port, name, attachments }) {
        yield* debug("IntroductionReceived", { name })
        const scope = yield* Scope.fork(outerScope, "sequential")

        const readyRef = yield* Ref.make<
          Option.Option<{
            readonly entry: Entry
            readonly key: string
            readonly currentClient: ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>
            readonly ActorLive: Layer.Layer<ActorSelf>
          }>
        >(Option.none())

        yield* Effect.gen(function* () {
          yield* Stream.fromEventListener<MessageEvent>(port, "message").pipe(
            Stream.runForEach(
              Effect.fnUntraced(
                function* (e) {
                  const state = yield* Ref.get(readyRef)
                  if (Option.isNone(state)) {
                    if (typeof e.data !== "string" || e.data !== expectedKey) {
                      yield* debug("AuditionFailed", { routed: e.data })
                      port.postMessage({
                        _tag: "Audition.Failure",
                        client: expectedKey,
                        routed: typeof e.data === "string" ? e.data : "<non-string>",
                      } satisfies typeof Audition.Failure.Type)
                      yield* Scope.close(scope, Exit.void)
                      port.close()
                      return
                    }
                    const key = yield* encodeName(name)
                    const entry = yield* getEntry(key)
                    const currentClient = yield* entry.directory.register(port, attachments)
                    const ActorLive = Layer.succeed(actor, {
                      name,
                      clients: entry.directory.handles,
                      currentClient,
                    })
                    port.postMessage({ _tag: "Audition.Success" } satisfies typeof Audition.Success.Type)
                    yield* onConnect.pipe(Effect.scoped, span("onConnect"), Effect.provide(ActorLive))
                    // Stream.runForEach is sequential: this set completes before the next message is pulled,
                    // so the Option.none branch above cannot race with message handling after audition.
                    yield* Ref.set(readyRef, Option.some({ entry, key, currentClient, ActorLive }))
                    return
                  }
                  const { entry, ActorLive } = state.value
                  yield* Effect.gen(function* () {
                    const message = yield* validateFPayload(e.data)
                    yield* debug("MessageReceived", { message })
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
                  const { entry, key } = state.value
                  yield* entry.directory.unregister(port)
                  if (entry.directory.handles.size === 0) delete entries[key]
                }
                yield* Scope.close(scope, Exit.void)
                port.close()
              }),
            ),
            Effect.forkScoped,
          )
        }).pipe(Scope.provide(scope))

        port.start()
      }, Effect.tapCause(logCause)),
    ),
  )
}, span("make"))
