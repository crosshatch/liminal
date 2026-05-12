import { Schema as S, Pipeable, Stream, Effect, Function, Types } from "effect"

import * as Client from "./Client.ts"
import { type ClientError, AuditionError } from "./errors.ts"
import type { Fn } from "./Fn.ts"
import type { Method } from "./Method.ts"
import type { ProtocolDefinition } from "./Protocol.ts"

const TypeId = "~liminal/Audition" as const

export interface Audition<
  AuditionSelf,
  State extends S.Union<ReadonlyArray<S.Top>>,
  Methods extends Record<string, Method>,
  Event,
>
  extends Pipeable.Pipeable {
  readonly [TypeId]: typeof TypeId

  readonly state: Stream.Stream<State["Type"], ClientError | S.SchemaError, AuditionSelf | State["DecodingServices"]>

  readonly fn: Fn<AuditionSelf, Methods>

  readonly events: Stream.Stream<Event, ClientError | S.SchemaError, AuditionSelf>
}

type MergeMethods<T extends Record<string, Method>, U extends Record<string, Method>> = Extract<
  {
    [K in keyof T | keyof U]: K extends keyof T
      ? K extends keyof U
        ? Types.Equals<T[K], U[K]> extends true
          ? T[K]
          : never
        : T[K]
      : K extends keyof U
        ? U[K]
        : never
  },
  Record<string, Method>
>

export const empty: Audition<never, never, {}, never> = {
  [TypeId]: TypeId,
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
  state: Stream.empty,
  fn: () => () => new AuditionError().asEffect(),
  events: Stream.fail(new AuditionError()),
}

export const add: {
  <ClientSelf, ClientId extends string, ClientD extends ProtocolDefinition>(
    client: Client.Client<ClientSelf, ClientId, ClientD>,
  ): <AuditionSelf, State extends S.Union<ReadonlyArray<S.Top>>, Methods extends Record<string, Method>, Event>(
    audition: Audition<AuditionSelf, State, Methods, Event>,
  ) => Audition<
    AuditionSelf | ClientSelf,
    S.Union<[...State["members"], S.Struct<ClientD["state"]>]>,
    MergeMethods<Methods, ClientD["methods"]>,
    Event | ReturnType<typeof S.TaggedUnion<ClientD["events"]>>["Type"]
  >
  <
    AuditionSelf,
    State extends S.Union<ReadonlyArray<S.Top>>,
    Methods extends Record<string, Method>,
    Event,
    ClientSelf,
    ClientId extends string,
    ClientD extends ProtocolDefinition,
  >(
    audition: Audition<AuditionSelf, State, Methods, Event>,
    client: Client.Client<ClientSelf, ClientId, ClientD>,
  ): Audition<
    AuditionSelf | ClientSelf,
    S.Union<[...State["members"], S.Struct<ClientD["state"]>]>,
    MergeMethods<Methods, ClientD["methods"]>,
    Event | ReturnType<typeof S.TaggedUnion<ClientD["events"]>>["Type"]
  >
} = Function.dual(
  2,
  <
    AuditionSelf,
    State extends S.Union<ReadonlyArray<S.Top>>,
    Methods extends Record<string, Method>,
    Event,
    ClientSelf,
    ClientId extends string,
    ClientD extends ProtocolDefinition,
  >(
    audition: Audition<AuditionSelf, State, Methods, Event>,
    client: Client.Client<ClientSelf, ClientId, ClientD>,
  ): Audition<
    AuditionSelf | ClientSelf,
    S.Union<[...State["members"], S.Struct<ClientD["state"]>]>,
    MergeMethods<Methods, ClientD["methods"]>,
    Event | ReturnType<typeof S.TaggedUnion<ClientD["events"]>>["Type"]
  > => {
    const fn: Fn<AuditionSelf | ClientSelf, MergeMethods<Methods, ClientD["methods"]>> =
      (method: string, ...f: Array<any>) =>
      (payload: any) =>
        audition
          .fn(method)(payload)
          .pipe(
            Effect.catchTag("AuditionError", () => client.fn(method)(payload)),
            ...(f as [any]),
          )

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
      state: state as never,
    }
  },
)
