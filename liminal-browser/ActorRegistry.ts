import type { TopFromString } from "liminal/_util/schema"
import type { Protocol, ProtocolDefinition } from "liminal/Protocol"

import { BrowserWorkerRunner } from "@effect/platform-browser"
import { Cause, Effect, Exit, Layer, Option, Ref, Schema as S, Scope, Semaphore, Stream } from "effect"
import { WorkerRunner } from "effect/unstable/workers"
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
  const Handlers extends Method.Handlers<D["methods"], any>,
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

  type ActorMessage = Protocol<D>["Actor"]["Type"]
  type ClientMessage = Protocol<D>["Client"]["Type"]

  const validateClientMessage = S.decodeUnknownEffect(S.toType(ClientM))
  const encodeName = S.encodeEffect(Name)

  interface Entry {
    readonly directory: ClientDirectory.ClientDirectory<MessagePort, ActorSelf, AttachmentFields, D>
    readonly mutex: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  }

  const entries: Record<string, Entry> = {}
  const runners = new Map<MessagePort, WorkerRunner.WorkerRunner<ActorMessage, ClientMessage>>()

  const transport: ActorTransport<MessagePort, AttachmentFields, D> = {
    send: (port, event) => runners.get(port)?.send(0, event) ?? Effect.void,
    close: () => Effect.void,
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
    Stream.runForEach(
      Effect.fnUntraced(function* ({ name, port, attachments }) {
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

        const backing = yield* BrowserWorkerRunner.make(port).start<ActorMessage, ClientMessage>()
        runners.set(port, backing)

        yield* Scope.addFinalizer(
          scope,
          Effect.gen(function* () {
            runners.delete(port)
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

        const onMessage = Effect.fnUntraced(function* (_portId: number, raw: ClientMessage) {
          const state = yield* Ref.get(stateRef)
          yield* Effect.gen(function* () {
            const message = yield* validateClientMessage(raw)
            yield* debug("MessageReceived", { message })
            if (Option.isNone(state)) {
              if (message._tag !== "Audition.Payload") {
                return yield* Effect.die(undefined)
              }
              const { client } = message
              if (client !== expectedKey) {
                yield* backing.send(0, {
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
              yield* backing.send(0, { _tag: "Audition.Success" } satisfies typeof Audition.Success.Type)
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
            yield* (
              handlers as Method.Handlers<
                D["methods"],
                Handlers[keyof Handlers] extends (p: never) => Effect.Effect<any, any, infer R> ? R : never
              >
            )[_tag]!(value).pipe(
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
              Effect.andThen((v) => backing.send(0, v)),
              span("handler", { attributes: { _tag } }),
              Effect.scoped,
              Effect.provide(ActorLive),
              entry.mutex,
            )
          })
        }, span("message"))

        yield* forkScoped(backing.run(onMessage).pipe(Effect.andThen(closeScope)))
      }),
    ),
    Effect.tapCause(logCause),
  )
}, span("make"))
