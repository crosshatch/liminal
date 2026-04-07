import type { FieldsRecord, Fields } from "liminal/_types"

import { WorkerRunner } from "@effect/platform"
import { Layer, Scope, Effect, Schema as S, PubSub, Ref, ExecutionStrategy, Exit, ParseResult, Stream } from "effect"
import { Actor, ClientHandle, Method, Protocol } from "liminal"

// TODO: use fiber map?
export const make = Effect.fnUntraced(function* <
  ActorSelf,
  ActorId extends string,
  NameA,
  AttachmentFields extends Fields,
  ClientSelf,
  ClientId extends string,
  MethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
  EventDefinitions extends FieldsRecord,
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
  const semaphore = yield* Effect.makeSemaphore(1)
  const task = semaphore.withPermits(1)
  const outer = yield* Scope.make()

  return Effect.gen(function* () {
    const inner = yield* Scope.fork(outer, ExecutionStrategy.sequential)
    const attachmentsRef = yield* Ref.make(attachments)
    const pubsub = yield* PubSub.unbounded<typeof schema.actor.Type>().pipe(
      Effect.acquireRelease(PubSub.shutdown),
      Scope.extend(inner),
    )
    const handle = ClientHandle.make<ActorSelf, AttachmentFields, EventDefinitions>({
      send: (_tag, payload) =>
        pubsub
          .publish({
            _tag: "Event",
            event: { _tag, ...payload },
          })
          .pipe(Effect.asVoid),
      attachments: Ref.get(attachmentsRef),
      save: (attachments) => Ref.set(attachmentsRef, attachments),
      disconnect: Effect.gen(function* () {
        yield* Scope.close(inner, Exit.void)
        handles.delete(handle)
      }),
    })
    handles.add(handle)
    yield* WorkerRunner.make<
      unknown,
      ParseResult.ParseError | E,
      Exclude<Effect.Effect.Context<ReturnType<Handlers[keyof Handlers]>>, ActorSelf> | R,
      typeof schema.actor.Type | void
    >((raw) => {
      if (typeof raw === "string") {
        const expected = actor.definition.client.key
        if (raw !== expected) {
          return Stream.succeed(
            Protocol.Audition.Failure.make({
              _tag: "Audition.Failure",
              actual: raw,
              expected,
            }),
          )
        }
        return Stream.succeed(
          Protocol.Audition.Success.make({
            _tag: "Audition.Success",
          }),
        ).pipe(
          Stream.concat(
            PubSub.subscribe(pubsub).pipe(
              Effect.tap(() => task(onConnect)),
              Effect.map(Stream.fromQueue),
              Stream.unwrapScoped,
            ),
          ),
        )
      }
      return Effect.gen(function* () {
        const message = yield* S.validate(schema.call.payload)(raw)
        const { id, payload } = message
        const { _tag, value } = payload
        const handler = handlers[_tag]
        yield* handler(value).pipe(
          Effect.matchEffect({
            onSuccess: (value) =>
              pubsub.offer({
                _tag: "Call.Success" as const,
                id,
                value: { _tag, value },
              }),
            onFailure: (value) =>
              pubsub.offer({
                _tag: "Call.Failure" as const,
                id,
                cause: { _tag, value },
              }),
          }),
        )
      }).pipe(task)
    }).pipe(
      Effect.provide(
        Layer.succeed(actor, {
          name,
          clients: handles,
          currentClient: handle,
        }),
      ),
      Scope.extend(inner),
    )
  })
})
