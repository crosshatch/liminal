import { Schema as S, Pipeable, Stream, Effect, Function } from "effect"

import type { F } from "./F.ts"

import * as Diagnostic from "./_util/Diagnostic.ts"
import * as Client from "./Client.ts"
import { type ClientError, AuditionError } from "./errors.ts"
import * as Protocol from "./Protocol.ts"

const { debug, span } = Diagnostic.module("Audition")

const TypeId = "~liminal/Audition" as const

export interface Audition<ClientSelf, D extends Protocol.ProtocolDefinition> extends Pipeable.Pipeable {
  readonly [TypeId]: typeof TypeId

  readonly events: Stream.Stream<ReturnType<typeof S.TaggedUnion<D["events"]>>["Type"], ClientError, ClientSelf>

  readonly f: F<ClientSelf, D>
}

export const empty: Audition<never, never> = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  events: Stream.fail(new AuditionError()),
  f: () => () => new AuditionError().asEffect(),
}

export const add: {
  <ClientSelf, ClientId extends string, ClientD extends Protocol.ProtocolDefinition>(
    client: Client.Client<ClientSelf, ClientId, ClientD>,
  ): <AuditionSelf, AuditionD extends Protocol.ProtocolDefinition>(
    audition: Audition<AuditionSelf, AuditionD>,
  ) => Audition<AuditionSelf | ClientSelf, Protocol.ProtocolDefinition.Merge<AuditionD, ClientD>>
  <
    AuditionClientSelf,
    AuditionD extends Protocol.ProtocolDefinition,
    ClientSelf,
    ClientId extends string,
    ClientD extends Protocol.ProtocolDefinition,
  >(
    audition: Audition<AuditionClientSelf, AuditionD>,
    client: Client.Client<ClientSelf, ClientId, ClientD>,
  ): Audition<AuditionClientSelf | ClientSelf, Protocol.ProtocolDefinition.Merge<AuditionD, ClientD>>
} = Function.dual(
  2,
  <
    AuditionSelf,
    AuditionD extends Protocol.ProtocolDefinition,
    ClientSelf,
    ClientId extends string,
    ClientD extends Protocol.ProtocolDefinition,
  >(
    audition: Audition<AuditionSelf, AuditionD>,
    client: Client.Client<ClientSelf, ClientId, ClientD>,
  ): Audition<AuditionSelf | ClientSelf, Protocol.ProtocolDefinition.Merge<AuditionD, ClientD>> => {
    const f: F<AuditionSelf | ClientSelf, Protocol.ProtocolDefinition.Merge<AuditionD, ClientD>> =
      (method) => (payload) =>
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
