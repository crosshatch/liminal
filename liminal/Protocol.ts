import { Schema as S, Record } from "effect"

import type { MethodDefinition } from "./Method.ts"

export const AuditionSuccess = S.TaggedStruct("AuditionSuccess", {})

export const AuditionFailure = S.TaggedStruct("AuditionFailure", {
  client: S.String,
  routed: S.String,
})

export interface ProtocolSchemas<
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
> {
  readonly f: {
    readonly payload: S.TaggedStruct<
      "FPayload",
      {
        readonly id: S.Int
        readonly payload: S.TaggedUnion<{
          readonly [K in keyof MethodDefinitions & string]: S.TaggedStruct<
            K,
            { readonly value: MethodDefinitions[K]["payload"] }
          >
        }>
      }
    >

    readonly success: S.TaggedStruct<
      "FSuccess",
      {
        readonly id: S.Int
        readonly success: S.TaggedUnion<{
          readonly [K in keyof MethodDefinitions & string]: S.TaggedStruct<
            K,
            { readonly value: MethodDefinitions[K]["success"] }
          >
        }>
      }
    >

    readonly failure: S.TaggedStruct<
      "FFailure",
      {
        readonly id: S.Int
        readonly failure: S.TaggedUnion<{
          readonly [K in keyof MethodDefinitions & string]: S.TaggedStruct<
            K,
            { readonly value: MethodDefinitions[K]["failure"] }
          >
        }>
      }
    >
  }

  readonly event: S.TaggedStruct<
    "Event",
    {
      readonly event: S.TaggedUnion<{
        readonly [K in keyof EventDefinitions & string]: S.TaggedStruct<K, EventDefinitions[K]>
      }>
    }
  >

  readonly actor: S.Union<
    [
      typeof AuditionSuccess,
      typeof AuditionFailure,
      this["f"]["success"],
      this["f"]["failure"],
      this["event"],
      typeof Disconnect,
    ]
  >
}

export const Disconnect = S.TaggedStruct("Disconnect", {})

export const TransportFailure = S.TaggedStruct("TransportFailure", { cause: S.Unknown })

export const ProtocolSchemas = <
  MethodDefinitions extends Record<string, MethodDefinition.Any>,
  EventDefinitions extends Record<string, S.Struct.Fields>,
>(
  methods: MethodDefinitions,
  events: EventDefinitions,
): ProtocolSchemas<MethodDefinitions, EventDefinitions> => {
  type T = ProtocolSchemas<MethodDefinitions, EventDefinitions>

  const f: T["f"] = {
    payload: S.TaggedStruct("FPayload", {
      id: S.Int,
      payload: S.TaggedUnion(Record.map(methods, ({ payload: value }) => ({ value }))),
    }) as never,
    success: S.TaggedStruct("FSuccess", {
      id: S.Int,
      success: S.TaggedUnion(Record.map(methods, ({ success: value }) => ({ value }))),
    }) as never,
    failure: S.TaggedStruct("FFailure", {
      id: S.Int,
      failure: S.TaggedUnion(Record.map(methods, ({ failure: value }) => ({ value }))),
    }) as never,
  }

  const event: T["event"] = S.TaggedStruct("Event", {
    event: S.TaggedUnion(Record.map(events, (fields) => ({ value: S.Struct(fields) }))),
  }) as never

  const actor: T["actor"] = S.Union([
    AuditionSuccess,
    AuditionFailure,
    f.success,
    f.failure,
    event,
    Disconnect,
  ]) as never

  return { f, event, actor }
}
