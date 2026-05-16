import { Schema as S, Pipeable, Stream, Effect, Function, Types } from "effect"

import * as Client from "./Client.ts"
import { type ClientError, AuditionError } from "./errors.ts"
import type { Fn } from "./Fn.ts"
import type { Methods } from "./Method.ts"
import type { ProtocolDefinition } from "./Protocol.ts"

const TypeId = "~liminal/Audition" as const

export interface Audition<AuditionSelf, State extends S.Union<ReadonlyArray<S.Top>>, External extends Methods, Event>
  extends Pipeable.Pipeable {
  readonly [TypeId]: typeof TypeId

  readonly state: Stream.Stream<State["Type"], ClientError | S.SchemaError, AuditionSelf | State["DecodingServices"]>

  readonly fn: Fn<AuditionSelf, External>

  readonly events: Stream.Stream<Event, ClientError | S.SchemaError, AuditionSelf>
}

type MergeMethods<T extends Methods, U extends Methods> = [keyof T] extends [never]
  ? U
  : { [K in keyof T & keyof U]: Types.Equals<T[K], U[K]> extends true ? T[K] : never }

type MergeState<State, D extends ProtocolDefinition> = [State] extends [never]
  ? S.Union<[S.Struct<D["state"]>]>
  : State extends S.Union<ReadonlyArray<S.Top>>
    ? S.Union<[...State["members"], S.Struct<D["state"]>]>
    : never

export const empty: Audition<never, never, {}, never> = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  state: Stream.fail(new AuditionError()),
  fn: () => () => new AuditionError().asEffect(),
  events: Stream.fail(new AuditionError()),
}

export const cycleOn =
  <Event>(predicate: (event: Event) => boolean) =>
  <AuditionSelf, State extends S.Union<ReadonlyArray<S.Top>>, External extends Methods>(
    audition: Audition<AuditionSelf, State, External, Event>,
  ): Audition<AuditionSelf, State, External, Event> => {
    const events = audition.events.pipe(Stream.takeUntil(predicate), Stream.forever)
    const state = audition.state.pipe(Stream.forever)

    return {
      [TypeId]: TypeId,
      pipe() {
        return Pipeable.pipeArguments(this, arguments)
      },
      events,
      fn: audition.fn,
      state,
    }
  }

export const add: {
  <ClientSelf, ClientId extends string, ClientD extends ProtocolDefinition>(
    client: Client.Client<ClientSelf, ClientId, ClientD>,
  ): <AuditionSelf, State extends S.Union<ReadonlyArray<S.Top>> | never, External extends Methods, Event>(
    audition: Audition<AuditionSelf, State, External, Event>,
  ) => Audition<
    AuditionSelf | ClientSelf,
    MergeState<State, ClientD>,
    MergeMethods<External, ClientD["external"]>,
    Event | ReturnType<typeof S.TaggedUnion<ClientD["events"]>>["Type"]
  >
  <
    AuditionSelf,
    State extends S.Union<ReadonlyArray<S.Top>> | never,
    External extends Methods,
    Event,
    ClientSelf,
    ClientId extends string,
    ClientD extends ProtocolDefinition,
  >(
    audition: Audition<AuditionSelf, State, External, Event>,
    client: Client.Client<ClientSelf, ClientId, ClientD>,
  ): Audition<
    AuditionSelf | ClientSelf,
    MergeState<State, ClientD>,
    MergeMethods<External, ClientD["external"]>,
    Event | ReturnType<typeof S.TaggedUnion<ClientD["events"]>>["Type"]
  >
} = Function.dual(
  2,
  <
    AuditionSelf,
    State extends S.Union<ReadonlyArray<S.Top>>,
    External extends Methods,
    Event,
    ClientSelf,
    ClientId extends string,
    ClientD extends ProtocolDefinition,
  >(
    audition: Audition<AuditionSelf, State, External, Event>,
    client: Client.Client<ClientSelf, ClientId, ClientD>,
  ): Audition<
    AuditionSelf | ClientSelf,
    MergeState<State, ClientD>,
    MergeMethods<External, ClientD["external"]>,
    Event | ReturnType<typeof S.TaggedUnion<ClientD["events"]>>["Type"]
  > => {
    const fn = ((method: string, ...f: [any]) =>
      Effect.fnUntraced(
        function* (payload: any) {
          return yield* audition
            .fn(method)(payload)
            .pipe(Effect.catchTag("AuditionError", () => client.fn(method)(payload)))
        },
        ...f,
      )) as Fn<AuditionSelf | ClientSelf, MergeMethods<External, ClientD["external"]>>

    const events = audition.events.pipe(
      Stream.catchTag("AuditionError", () => Effect.succeed(client.events).pipe(Stream.unwrap)),
    )

    const state = audition.state.pipe(
      Stream.catchTag("AuditionError", () => Effect.succeed(client.state).pipe(Stream.unwrap)),
    )

    return {
      [TypeId]: TypeId,
      pipe() {
        return Pipeable.pipeArguments(this, arguments)
      },
      events,
      fn,
      state,
    }
  },
)
