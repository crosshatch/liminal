import { Scope, Effect, Schema as S, PubSub, Ref, Exit, Stream, Semaphore } from "effect"
import { WorkerRunner } from "effect/unstable/workers"
import { type Actor, ClientHandle, type Method, type Protocol } from "liminal"
import * as Diagnostic from "liminal/_util/Diagnostic"

const { span } = Diagnostic.module("browser.Singleton")

export const make = Effect.fnUntraced(function* <
  ActorSelf,
  ActorId extends string,
  NameA,
  AttachmentFields extends S.Struct.Fields,
  ClientSelf,
  ClientId extends string,
  D extends Protocol.ProtocolDefinition,
  Handlers extends Method.Handlers<D["methods"], any>,
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
  readonly actor: Actor.Actor<ActorSelf, ActorId, NameA, AttachmentFields, ClientSelf, ClientId, D>
  readonly name: NameA
  readonly attachments: S.Struct<AttachmentFields>["Type"]
  readonly handlers: Handlers
  readonly onConnect: Effect.Effect<A, E, R>
}) {
  const { protocol } = actor.definition.client
  type _ = typeof protocol

  const handles = new Set<ClientHandle.ClientHandle<ActorSelf, AttachmentFields, D>>()
  const semaphore = yield* Semaphore.make(1)
  const task = semaphore.withPermits(1)
  const outer = yield* Scope.make()

  return Effect.gen(function* () {
    const inner = yield* Scope.fork(outer, "sequential")
    const attachmentsRef = yield* Ref.make(attachments)
    const pubsub = yield* Effect.acquireRelease(PubSub.unbounded<_["Actor"]["Type"]>(), PubSub.shutdown).pipe(
      Scope.provide(inner),
    )
    const handle = ClientHandle.make<ActorSelf, AttachmentFields, D>({
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
    const runner = yield* platform.start<_["Actor"]["Type"], unknown>()

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
            protocol.Audition.Failure.make({
              routed: raw,
              client: expected,
            }),
          )
        }
        return Effect.gen(function* () {
          yield* runner.send(portId, protocol.Audition.Success.make({}))
          const subscription = yield* PubSub.subscribe(pubsub).pipe(Scope.provide(inner))
          yield* task(onConnect).pipe(Effect.provideService(actor, { name, clients: handles, currentClient: handle }))
          yield* Stream.fromSubscription(subscription).pipe(
            Stream.runForEach((message) => runner.send(portId, message)),
          )
        })
      }

      return Effect.gen(function* () {
        const message = yield* S.decodeUnknownEffect(S.toType(protocol.F.Payload))(raw)
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
                _tag: "F.Success" as const,
                id,
                success: { _tag, value } as never,
              }),
            onFailure: (value) =>
              PubSub.publish(pubsub, {
                _tag: "F.Failure" as const,
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
