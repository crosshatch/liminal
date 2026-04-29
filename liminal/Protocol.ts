import { Schema as S, Record, Types } from "effect"
import * as TraceEnvelope from "liminal-util/TraceUtil"

import type * as Method from "./Method.ts"

export interface ProtocolDefinition<
  Methods extends Record<string, Method.Any> = Record<string, Method.Any>,
  Events extends Record<string, S.Struct.Fields> = Record<string, S.Struct.Fields>,
> {
  readonly methods: Methods

  readonly events: Events
}

export declare namespace ProtocolDefinition {
  export type Merge<T extends ProtocolDefinition, U extends ProtocolDefinition> = ProtocolDefinition<
    [T] extends [never]
      ? U["methods"]
      : {
          [K in keyof T["methods"] & keyof U["methods"] as Types.Equals<T["methods"][K], U["methods"][K]> extends true
            ? K
            : never]: T["methods"][K]
        },
    [T] extends [never] ? U["events"] : T["events"] & U["events"]
  >
}

export interface Protocol<D extends ProtocolDefinition> {
  readonly Audition: {
    readonly Payload: S.TaggedStruct<"Audition.Payload", { client: S.String }>
    readonly Success: S.TaggedStruct<"Audition.Success", {}>
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
      readonly trace: S.optional<typeof TraceEnvelope.TraceEnvelope>
    }
  >

  readonly F: {
    readonly Payload: S.TaggedStruct<
      "F.Payload",
      {
        readonly id: S.Int
        readonly payload: S.TaggedUnion<{
          readonly [K in keyof D["methods"] & string]: S.TaggedStruct<K, { readonly value: D["methods"][K]["payload"] }>
        }>
        readonly trace: S.optional<typeof TraceEnvelope.TraceEnvelope>
      }
    >

    readonly Success: S.TaggedStruct<
      "F.Success",
      {
        readonly id: S.Int
        readonly success: S.TaggedUnion<{
          readonly [K in keyof D["methods"] & string]: S.TaggedStruct<K, { readonly value: D["methods"][K]["success"] }>
        }>
      }
    >

    readonly Failure: S.TaggedStruct<
      "F.Failure",
      {
        readonly id: S.Int
        readonly failure: S.TaggedUnion<{
          readonly [K in keyof D["methods"] & string]: S.TaggedStruct<K, { readonly value: D["methods"][K]["failure"] }>
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

const Audition = {
  Payload: S.TaggedStruct("Audition.Payload", {
    client: S.String,
  }),
  Success: S.TaggedStruct("Audition.Success", {}),
  Failure: S.TaggedStruct("Audition.Failure", {
    expected: S.String,
    actual: S.String,
  }),
}

export const Protocol = <D extends ProtocolDefinition>({ events, methods }: D): Protocol<D> => {
  type T = Protocol<D>

  const F: T["F"] = {
    Payload: S.TaggedStruct("F.Payload", {
      id: S.Int,
      payload: S.TaggedUnion(Record.map(methods, ({ payload: value }) => ({ value }))),
      trace: S.optional(TraceEnvelope.TraceEnvelope),
    }) as never,
    Success: S.TaggedStruct("F.Success", {
      id: S.Int,
      success: S.TaggedUnion(Record.map(methods, ({ success: value }) => ({ value }))),
    }) as never,
    Failure: S.TaggedStruct("F.Failure", {
      id: S.Int,
      failure: S.TaggedUnion(Record.map(methods, ({ failure: value }) => ({ value }))),
    }) as never,
  }

  const Event: T["Event"] = S.TaggedStruct("Event", {
    event: S.TaggedUnion(events),
    trace: S.optional(TraceEnvelope.TraceEnvelope),
  }) as never

  const Client: T["Client"] = S.Union([Audition.Payload, F.Payload, Disconnect])

  const Actor: T["Actor"] = S.Union([Audition.Success, Audition.Failure, F.Success, F.Failure, Event, Disconnect])

  return { Audition, Event, F, Client, Actor, Disconnect }
}
