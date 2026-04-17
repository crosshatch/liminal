import { Scope, Effect, Schema as S, PubSub, Ref, Exit, Stream, Semaphore } from "effect"
import { WorkerRunner } from "effect/unstable/workers"
import { Actor, ClientHandle, Method, Protocol } from "liminal"
import * as Diagnostic from "liminal/_util/Diagnostic"

const { span } = Diagnostic.module("browser.Singleton")

export const make = Effect.fnUntraced(function* <
  ActorSelf,
  ActorId extends string,
  NameA,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
  Handlers extends Method.Handlers<MethodDefinitions, any>,
  A,
  E,
  R,
>({
  actor,
  name,
  attachments,
  handlers,
  onConnect,
}: {
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
  readonly name: NameA
  readonly attachments: S.Struct<AttachmentFields>["Type"]
  readonly handlers: Handlers
  readonly onConnect: Effect.Effect<A, E, R>
}) {
  const { schema } = actor.definition.client
  const handles = new Set<ClientHandle.ClientHandle<ActorSelf, AttachmentFields, EventDefinitions>>()
  const semaphore = yield* Semaphore.make(1)
  const task = semaphore.withPermits(1)
  const outer = yield* Scope.make()

  return Effect.gen(function* () {
    const inner = yield* Scope.fork(outer, "sequential")
    const attachmentsRef = yield* Ref.make(attachments)
    const pubsub = yield* Effect.acquireRelease(PubSub.unbounded<typeof schema.actor.Type>(), PubSub.shutdown).pipe(
      Scope.provide(inner),
    )
    const handle = ClientHandle.make<ActorSelf, AttachmentFields, EventDefinitions>({
      send: (_tag, payload) =>
        PubSub.publish(pubsub, {
          _tag: "Event",
          event: { _tag, ...payload } as never,
        }).pipe(Effect.asVoid),
      attachments: Ref.get(attachmentsRef),
      save: (attachments) => Ref.set(attachmentsRef, attachments),
      disconnect: Effect.gen(function* () {
        yield* Scope.close(inner, Exit.void)
        handles.delete(handle)
      }),
    })
    handles.add(handle)

    const platform = yield* WorkerRunner.WorkerRunnerPlatform
    const runner = yield* platform.start<typeof schema.actor.Type, unknown>()

    yield* runner.run<
      void,
      S.SchemaError | E,
      Exclude<Effect.Services<ReturnType<Handlers[keyof Handlers]>> | R, ActorSelf>
    >((portId, raw) => {
      if (typeof raw === "string") {
        const expected = actor.definition.client.key
        if (raw !== expected) {
          return runner.send(
            portId,
            Protocol.AuditionFailure.make({
              routed: raw,
              client: expected,
            }),
          )
        }
        return Effect.gen(function* () {
          yield* runner.send(portId, Protocol.AuditionSuccess.make({}))
          const subscription = yield* PubSub.subscribe(pubsub).pipe(Scope.provide(inner))
          yield* task(onConnect).pipe(Effect.provideService(actor, { name, clients: handles, currentClient: handle }))
          yield* Stream.fromSubscription(subscription).pipe(
            Stream.runForEach((message) => runner.send(portId, message)),
          )
        })
      }

      return Effect.gen(function* () {
        const message = yield* S.decodeUnknownEffect(S.toType(schema.f.payload))(raw)
        const { id, payload } = message
        const { _tag, value } = payload as never
        const handler = handlers[_tag]!
        yield* handler(value).pipe(
          Effect.provideService(actor, {
            name,
            clients: handles,
            currentClient: handle,
          }),
          Effect.matchEffect({
            onSuccess: (value) =>
              PubSub.publish(pubsub, {
                _tag: "FSuccess" as const,
                id,
                success: { _tag, value } as never,
              }),
            onFailure: (value) =>
              PubSub.publish(pubsub, {
                _tag: "FFailure" as const,
                id,
                failure: { _tag, value } as never,
              }),
          }),
          span("handler", { attributes: { _tag } }),
        )
      }).pipe(task)
    })
  })
})
