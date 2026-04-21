import { flow, Schema as S, Record, Types, Effect } from "effect"

import type { TopFromString } from "./_util/schema.ts"
import type * as Method from "./Method.ts"

import { phantom } from "./_util/phantom.ts"

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
    readonly Success: S.TaggedStruct<"Audition.Success", {}>
    readonly Failure: S.TaggedStruct<
      "Audition.Failure",
      {
        client: S.String
        routed: S.String
      }
    >
  }

  readonly Event: S.TaggedStruct<
    "Event",
    {
      readonly event: S.TaggedUnion<{
        readonly [K in keyof D["events"] & string]: S.TaggedStruct<K, D["events"][K]>
      }>
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

const Disconnect = S.TaggedStruct("Disconnect", {})

const Audition = {
  Success: S.TaggedStruct("Audition.Success", {}),
  Failure: S.TaggedStruct("Audition.Failure", {
    client: S.String,
    routed: S.String,
  }),
}

export const Protocol = <D extends ProtocolDefinition>({ events, methods }: D): Protocol<D> => {
  type T = Protocol<D>

  const F: T["F"] = {
    Payload: S.TaggedStruct("F.Payload", {
      id: S.Int,
      payload: S.TaggedUnion(Record.map(methods, ({ payload: value }) => ({ value }))),
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
  }) as never

  const Actor: T["Actor"] = S.Union([Audition.Success, Audition.Failure, F.Success, F.Failure, Event, Disconnect])

  return { Audition, Event, F, Actor, Disconnect }
}

const toJsonStringCodec = flow(S.toCodecJson, S.fromJsonString)
const encode = flow(toJsonStringCodec, S.encodeEffect)
const decode = flow(toJsonStringCodec, S.decodeUnknownEffect)

export interface ClientTranscoders<D extends ProtocolDefinition> {
  "": Protocol<D>

  readonly encodeFPayload: (
    input: this[""]["F"]["Payload"]["Type"],
  ) => Effect.Effect<string, S.SchemaError, this[""]["F"]["Payload"]["EncodingServices"]>

  readonly decodeActor: (
    input: unknown,
  ) => Effect.Effect<this[""]["Actor"]["Type"], S.SchemaError, this[""]["Actor"]["DecodingServices"]>
}

export const ClientTranscoders = <D extends ProtocolDefinition>({ F, Actor }: Protocol<D>): ClientTranscoders<D> => ({
  ...phantom,
  encodeFPayload: encode(F.Payload),
  decodeActor: decode(Actor),
})

export interface ActorTranscoders<
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  D extends ProtocolDefinition,
> {
  "": Protocol<D>

  readonly encodeName: (input: Name["Type"]) => Effect.Effect<string, S.SchemaError, Name["EncodingServices"]>

  readonly encodeAttachments: (
    input: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<S.Json, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>

  readonly decodeAttachments: (
    input: unknown,
  ) => Effect.Effect<S.Struct<AttachmentFields>["Type"], S.SchemaError, S.Struct<AttachmentFields>["DecodingServices"]>

  readonly encodeAuditionSuccess: (
    input: this[""]["Audition"]["Success"]["Type"],
  ) => Effect.Effect<string, S.SchemaError, this[""]["Audition"]["Success"]["EncodingServices"]>

  readonly encodeAuditionFailure: (
    input: this[""]["Audition"]["Failure"]["Type"],
  ) => Effect.Effect<string, S.SchemaError, this[""]["Audition"]["Failure"]["EncodingServices"]>

  readonly encodeEvent: (
    input: this[""]["Event"]["Type"],
  ) => Effect.Effect<string, S.SchemaError, this[""]["Event"]["EncodingServices"]>

  readonly decodeFPayload: (
    input: unknown,
  ) => Effect.Effect<this[""]["F"]["Payload"]["Type"], S.SchemaError, this[""]["F"]["Payload"]["DecodingServices"]>

  readonly encodeFSuccess: (
    input: this[""]["F"]["Success"]["Type"],
  ) => Effect.Effect<string, S.SchemaError, this[""]["F"]["Success"]["EncodingServices"]>

  readonly encodeFFailure: (
    input: this[""]["F"]["Failure"]["Type"],
  ) => Effect.Effect<string, S.SchemaError, this[""]["F"]["Failure"]["EncodingServices"]>

  readonly encodeDisconnect: (
    input: this[""]["Disconnect"]["Type"],
  ) => Effect.Effect<string, S.SchemaError, this[""]["Disconnect"]["EncodingServices"]>
}

export const ActorTranscoders = <
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  D extends ProtocolDefinition,
>(
  name: Name,
  attachments: AttachmentFields,
  { F, Event, Disconnect, Audition }: Protocol<D>,
): ActorTranscoders<Name, AttachmentFields, D> => ({
  ...phantom,
  encodeName: S.encodeEffect(name),
  encodeAttachments: S.encodeEffect(S.toCodecJson(S.Struct(attachments))),
  decodeAttachments: S.decodeUnknownEffect(S.toCodecJson(S.Struct(attachments))),
  encodeAuditionSuccess: encode(Audition.Success),
  encodeAuditionFailure: encode(Audition.Failure),
  encodeEvent: encode(Event),
  decodeFPayload: decode(F.Payload),
  encodeFSuccess: encode(F.Success),
  encodeFFailure: encode(F.Failure),
  encodeDisconnect: encode(Disconnect),
})
