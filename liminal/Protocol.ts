import { Schema as S, Record } from "effect"

import type { Methods } from "./Method.ts"
import * as Tracing from "./Tracing.ts"

export interface ProtocolDefinition<
  State extends S.Struct.Fields = S.Struct.Fields,
  External extends Methods = Methods,
  Events extends Record<string, S.Struct.Fields> = Record<string, S.Struct.Fields>,
> {
  readonly state: State

  readonly external: External

  readonly events: Events
}

export interface Protocol<D extends ProtocolDefinition> {
  readonly Audition: {
    readonly Payload: S.TaggedStruct<"Audition.Payload", { readonly client: S.String }>
    readonly Success: S.TaggedStruct<"Audition.Success", { readonly initial: S.Struct<D["state"]> }>
    readonly Failure: S.TaggedStruct<
      "Audition.Failure",
      {
        expected: S.String
        actual: S.String
      }
    >
  }

  readonly Event: S.TaggedStruct<
    "Event",
    {
      readonly event: S.TaggedUnion<{
        readonly [K in keyof D["events"] & string]: S.TaggedStruct<K, D["events"][K]>
      }>
      readonly trace: S.optional<typeof Tracing.TraceEnvelope>
    }
  >

  readonly F: {
    readonly Payload: S.TaggedStruct<
      "F.Payload",
      {
        readonly id: S.Int
        readonly payload: S.TaggedUnion<{
          readonly [K in keyof D["external"] & string]: S.TaggedStruct<
            K,
            { readonly value: D["external"][K]["payload"] }
          >
        }>
        readonly trace: S.optional<typeof Tracing.TraceEnvelope>
      }
    >

    readonly Success: S.TaggedStruct<
      "F.Success",
      {
        readonly id: S.Int
        readonly success: S.TaggedUnion<{
          readonly [K in keyof D["external"] & string]: S.TaggedStruct<
            K,
            { readonly value: D["external"][K]["success"] }
          >
        }>
      }
    >

    readonly Failure: S.TaggedStruct<
      "F.Failure",
      {
        readonly id: S.Int
        readonly failure: S.TaggedUnion<{
          readonly [K in keyof D["external"] & string]: S.TaggedStruct<
            K,
            { readonly value: D["external"][K]["failure"] }
          >
        }>
      }
    >
  }

  readonly Disconnect: S.TaggedStruct<"Disconnect", {}>

  readonly Client: S.Union<[this["Audition"]["Payload"], this["F"]["Payload"], this["Disconnect"]]>

  readonly Actor: S.Union<
    [
      this["Audition"]["Success"],
      this["Audition"]["Failure"],
      this["F"]["Success"],
      this["F"]["Failure"],
      this["Event"],
      this["Disconnect"],
    ]
  >
}

export const Disconnect = S.TaggedStruct("Disconnect", {})

const AuditionPayload = S.TaggedStruct("Audition.Payload", {
  client: S.String,
})

const AuditionFailure = S.TaggedStruct("Audition.Failure", {
  expected: S.String,
  actual: S.String,
})

export const Protocol = <D extends ProtocolDefinition>({ state, events, external }: D): Protocol<D> => {
  type T = Protocol<D>

  const Audition = {
    Payload: AuditionPayload,
    Success: S.TaggedStruct("Audition.Success", { initial: S.Struct(state) }),
    Failure: AuditionFailure,
  }

  const F: T["F"] = {
    Payload: S.TaggedStruct("F.Payload", {
      id: S.Int,
      payload: S.TaggedUnion(Record.map(external, ({ payload: value }) => ({ value }))),
      trace: S.optional(Tracing.TraceEnvelope),
    }) as never,
    Success: S.TaggedStruct("F.Success", {
      id: S.Int,
      success: S.TaggedUnion(Record.map(external, ({ success: value }) => ({ value }))),
    }) as never,
    Failure: S.TaggedStruct("F.Failure", {
      id: S.Int,
      failure: S.TaggedUnion(Record.map(external, ({ failure: value }) => ({ value }))),
    }) as never,
  }

  const Event: T["Event"] = S.TaggedStruct("Event", {
    event: S.TaggedUnion(events),
    trace: S.optional(Tracing.TraceEnvelope),
  }) as never

  const Client: T["Client"] = S.Union([Audition.Payload, F.Payload, Disconnect])

  const Actor: T["Actor"] = S.Union([Audition.Success, Audition.Failure, F.Success, F.Failure, Event, Disconnect])

  return { Audition, Event, F, Client, Actor, Disconnect }
}
