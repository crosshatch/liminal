import { Schema as S, Pipeable, Stream, Effect, Function } from "effect"

import type { F } from "./F.ts"
import type * as Method from "./Method.ts"

import * as Diagnostic from "./_util/Diagnostic.ts"
import * as Client from "./Client.ts"
import { type ClientError, AuditionError } from "./errors.ts"

const { debug, span } = Diagnostic.module("Audition")

const TypeId = "~liminal/Audition" as const

export interface Audition<ClientSelf, MethodDefinitions extends Record<string, Method.MethodDefinition.Any>, Event>
  extends Pipeable.Pipeable {
  readonly [TypeId]: typeof TypeId

  readonly events: Stream.Stream<Event, ClientError, ClientSelf>

  readonly f: F<ClientSelf, MethodDefinitions>
}

export const empty: Audition<never, never, never> = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  events: Stream.fail(new AuditionError()),
  f: () => () => new AuditionError().asEffect(),
}

export const add: {
  <
    ClientSelf,
    ClientId extends string,
    ClientMethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
    ClientEventDefinitions extends Record<string, S.Struct.Fields>,
  >(
    client: Client.Client<ClientSelf, ClientId, ClientMethodDefinitions, ClientEventDefinitions>,
  ): <AuditionSelf, AuditionMethodDefinitions extends Record<string, Method.MethodDefinition.Any>, AuditionEvent>(
    audition: Audition<AuditionSelf, AuditionMethodDefinitions, AuditionEvent>,
  ) => Audition<
    AuditionSelf | ClientSelf,
    Method.MethodDefinition.Merge<AuditionMethodDefinitions, ClientMethodDefinitions>,
    AuditionEvent | ReturnType<typeof S.TaggedUnion<ClientEventDefinitions>>["Type"]
  >
  <
    AuditionClientSelf,
    AuditionMethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
    AuditionEvent,
    ClientSelf,
    ClientId extends string,
    ClientMethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
    ClientEventDefinitions extends Record<string, S.Struct.Fields>,
  >(
    audition: Audition<AuditionClientSelf, AuditionMethodDefinitions, AuditionEvent>,
    client: Client.Client<ClientSelf, ClientId, ClientMethodDefinitions, ClientEventDefinitions>,
  ): Audition<
    AuditionClientSelf | ClientSelf,
    Method.MethodDefinition.Merge<AuditionMethodDefinitions, ClientMethodDefinitions>,
    AuditionEvent | ReturnType<typeof S.TaggedUnion<ClientEventDefinitions>>["Type"]
  >
} = Function.dual(
  2,
  <
    AuditionSelf,
    AuditionMethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
    AuditionEvent,
    ClientSelf,
    ClientId extends string,
    ClientMethodDefinitions extends Record<string, Method.MethodDefinition.Any>,
    ClientEventDefinitions extends Record<string, S.Struct.Fields>,
  >(
    audition: Audition<AuditionSelf, AuditionMethodDefinitions, AuditionEvent>,
    client: Client.Client<ClientSelf, ClientId, ClientMethodDefinitions, ClientEventDefinitions>,
  ): Audition<
    AuditionSelf | ClientSelf,
    Method.MethodDefinition.Merge<AuditionMethodDefinitions, ClientMethodDefinitions>,
    AuditionEvent | ReturnType<typeof S.TaggedUnion<ClientEventDefinitions>>["Type"]
  > => {
    const f: F<
      AuditionSelf | ClientSelf,
      Method.MethodDefinition.Merge<AuditionMethodDefinitions, ClientMethodDefinitions>
    > = (method) => (payload) =>
      audition
        .f(method as never)(payload)
        .pipe(
          Effect.catchTag("AuditionError", () => client.f(method as never)(payload)),
          span("f"),
        )

    const events = audition.events.pipe(
      Stream.catchTag("AuditionError", () =>
        Effect.succeed(client.events).pipe(
          Effect.tap(() => debug("AuditionStaged", { client: client.key })),
          Stream.unwrap,
        ),
      ),
    )

    return {
      [TypeId]: TypeId,
      pipe() {
        return Pipeable.pipeArguments(this, arguments)
      },
      events,
      f,
    }
  },
)
