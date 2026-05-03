import { BrowserWorkerRunner } from "@effect/platform-browser"
import { Cause, Effect, Exit, Layer, Option, Ref, Schema as S, Scope, Semaphore, Stream, Tracer } from "effect"
import { WorkerRunner } from "effect/unstable/workers"
import { logCause } from "liminal-util/logCause"
import * as Spanner from "liminal-util/Spanner"
import * as TraceUtil from "liminal-util/TraceUtil"

import type { TopFromString } from "../_util/schema.ts"
import type { Actor } from "../Actor.ts"
import type { ActorTransport } from "../ActorTransport.ts"
import type { ClientHandle } from "../ClientHandle.ts"
import type { ProtocolDefinition } from "../Protocol.ts"

import * as ClientDirectory from "../ClientDirectory.ts"
import * as Method from "../Method.ts"

const span = Spanner.make(import.meta.url)

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
  readonly actor: Actor<ActorSelf, ActorId, Name, AttachmentFields, ClientSelf, ClientId, D>
  readonly handlers: Handlers
  readonly onConnect: Effect.Effect<A, E, R>
  readonly introductions: Stream.Stream<Introduction<Name, AttachmentFields>, IntroductionE, IntroductionR>
}) {
  const {
    definition: {
      client: {
        protocol: { Client: ClientM, Actor },
        key: expected,
      },
      name: Name,
    },
  } = actor

  const validateClientMessage = S.decodeUnknownEffect(S.toType(ClientM))
  const encodeName = S.encodeEffect(Name)

  interface BrowserClient {
    readonly backing: WorkerRunner.WorkerRunner<typeof Actor.Type, typeof ClientM.Type>

    readonly close: Effect.Effect<void>
  }

  interface Entry {
    readonly directory: ClientDirectory.ClientDirectory<MessagePort, BrowserClient, ActorSelf, AttachmentFields, D>
    readonly mutex: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  }

  const entries: Record<string, Entry> = {}

  const transport: ActorTransport<BrowserClient, AttachmentFields, D> = {
    send: ({ backing }, event) => {
      const { _tag } = event.event as never
      return Effect.gen(function* () {
        const trace = yield* TraceUtil.currentTrace
        yield* backing.send(0, {
          ...event,
          ...(trace && { trace }),
        })
      }).pipe(span("event.send", { attributes: { _tag }, kind: "producer" }))
    },
    close: ({ close }) => close,
    snapshot: () => Effect.void,
  }

  const useEntries = yield* Semaphore.make(1).pipe(Effect.map((v) => v.withPermits(1)))

  const getEntry = Effect.fnUntraced(function* (key: string) {
    const existing = entries[key]
    if (existing) return existing
    const directory = ClientDirectory.make<
      MessagePort,
      BrowserClient,
      ActorSelf,
      ActorId,
      Name,
      AttachmentFields,
      ClientSelf,
      ClientId,
      D
    >(actor, { transport })
    const semaphore = yield* Semaphore.make(1)
    const fresh = {
      directory,
      mutex: semaphore.withPermits(1),
    }
    entries[key] = fresh
    return fresh
  }, useEntries)

  const outerScope = yield* Scope.Scope

  yield* introductions.pipe(
    Stream.runForEach(
      Effect.fnUntraced(function* ({ name, port, attachments }) {
        const stateRef = yield* Ref.make<
          Option.Option<{
            readonly key: string
            readonly entry: Entry
            readonly currentClient: ClientHandle<ActorSelf, AttachmentFields, D>
            readonly ActorLive: Layer.Layer<ActorSelf>
          }>
        >(Option.none())

        const scope = yield* Scope.fork(outerScope, "sequential")
        const closeScope = Scope.close(scope, Exit.void)

        const backing = yield* BrowserWorkerRunner.make(port).start<typeof Actor.Type, typeof ClientM.Type>()

        yield* Scope.addFinalizer(
          scope,
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            if (state._tag === "Some") {
              const {
                key,
                entry: { directory },
              } = state.value
              yield* directory.unregister(port)
              if (directory.handles.size === 0) {
                delete entries[key]
              }
            }
          }).pipe(useEntries),
        )

        yield* backing
          .run(
            Effect.fnUntraced(function* (_portId, raw) {
              const state = yield* Ref.get(stateRef)
              yield* Effect.gen(function* () {
                const message = yield* validateClientMessage(raw)
                if (state._tag === "None") {
                  if (message._tag !== "Audition.Payload") {
                    return yield* Effect.die(undefined)
                  }
                  const { client: actual } = message
                  if (actual !== expected) {
                    yield* backing.send(0, {
                      _tag: "Audition.Failure",
                      expected,
                      actual,
                    })
                    return yield* closeScope
                  }
                  const key = yield* encodeName(name)
                  const entry = yield* getEntry(key)
                  const currentClient = yield* entry.directory.register(
                    port,
                    { backing, close: closeScope },
                    attachments,
                  )
                  const ActorLive = Layer.succeed(actor, {
                    name,
                    clients: entry.directory.handles,
                    currentClient,
                  })
                  yield* Ref.set(stateRef, Option.some({ key, entry, currentClient, ActorLive }))
                  yield* backing.send(0, { _tag: "Audition.Success" })
                  return yield* onConnect.pipe(entry.mutex, Effect.scoped, span("onConnect"), Effect.provide(ActorLive))
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
                const parent = message.trace && Tracer.externalSpan(message.trace)
                const transportSpan = yield* TraceUtil.parent
                yield* (
                  handlers as Method.Handlers<
                    D["methods"],
                    Handlers[keyof Handlers] extends (v: never) => Effect.Effect<any, any, infer R> ? R : never
                  >
                )[_tag]!(value).pipe(
                  Effect.match({
                    onSuccess: (value) => ({
                      _tag: "F.Success" as const,
                      id,
                      success: { _tag, value } as never,
                    }),
                    onFailure: (value) => ({
                      _tag: "F.Failure" as const,
                      id,
                      failure: { _tag, value } as never,
                    }),
                  }),
                  Effect.andThen((v) => backing.send(0, v)),
                  span("handler", {
                    attributes: { _tag },
                    kind: "server",
                    parent,
                    links:
                      parent && transportSpan
                        ? [
                            {
                              span: transportSpan,
                              attributes: {
                                "liminal.link": "transport",
                                "liminal.transport": "worker",
                              },
                            },
                          ]
                        : undefined,
                  }),
                  Effect.scoped,
                  Effect.provide(ActorLive),
                  entry.mutex,
                )
              })
            }, span("message")),
          )
          .pipe(
            Effect.andThen(closeScope),
            Effect.catchCause((cause) =>
              Cause.hasInterruptsOnly(cause) ? Effect.void : logCause(cause).pipe(Effect.andThen(closeScope)),
            ),
            Effect.forkScoped,
            Scope.provide(scope),
          )
      }),
    ),
    Effect.tapCause(logCause),
  )
}, span("make"))
