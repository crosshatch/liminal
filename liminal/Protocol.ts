import { Schema as S } from "effect"

import type { FieldsRecord } from "./_types.ts"
import type { MethodDefinition } from "./Method.ts"

export declare namespace CallMessage {
  export type Type<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
    readonly _tag: "Call"

    readonly id: number

    readonly payload: {
      [K in keyof MethodDefinitions]: {
        readonly _tag: K
        readonly value: S.Struct<MethodDefinitions[K]["payload"]>["Type"]
      }
    }[keyof MethodDefinitions]
  }

  export type Encoded<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
    readonly _tag: "Call"

    readonly id: number

    readonly payload: {
      [K in keyof MethodDefinitions]: {
        readonly _tag: K
        readonly value: S.Struct<MethodDefinitions[K]["payload"]>["Encoded"]
      }
    }[keyof MethodDefinitions]
  }
}

export declare namespace SuccessMessage {
  export type Type<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
    readonly _tag: "Success"

    readonly id: number

    readonly value: {
      readonly [K in keyof MethodDefinitions]: {
        readonly _tag: K
        readonly value: MethodDefinitions[K]["success"]["Type"]
      }
    }[keyof MethodDefinitions]
  }

  export type Encoded<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
    readonly _tag: "Success"

    readonly id: number

    readonly value: {
      readonly [K in keyof MethodDefinitions]: {
        readonly _tag: K
        readonly value: MethodDefinitions[K]["success"]["Encoded"]
      }
    }[keyof MethodDefinitions]
  }
}

export declare namespace FailureMessage {
  export type Type<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
    readonly _tag: "Failure"

    readonly id: number

    readonly cause: {
      readonly [K in keyof MethodDefinitions]: {
        readonly _tag: K
        readonly value: MethodDefinitions[K]["failure"]["Type"]
      }
    }[keyof MethodDefinitions]
  }

  export type Encoded<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
    readonly _tag: "Failure"

    readonly id: number

    readonly cause: {
      readonly [K in keyof MethodDefinitions]: {
        readonly _tag: K
        readonly value: MethodDefinitions[K]["failure"]["Encoded"]
      }
    }[keyof MethodDefinitions]
  }
}

export declare namespace EventMessage {
  export type Type<EventDefinitions extends FieldsRecord> = {
    readonly _tag: "Event"

    readonly event: FieldsRecord.TaggedMember.Type<EventDefinitions>
  }

  export type Encoded<EventDefinitions extends FieldsRecord> = {
    readonly _tag: "Event"

    readonly event: FieldsRecord.TaggedMember.Encoded<EventDefinitions>
  }
}

export const AuditionSuccessMessage = S.TaggedStruct("AuditionSucceeded", {})

export const AuditionFailureMessage = S.TaggedStruct("AuditionFailure", {
  expected: S.String,
  actual: S.String,
})

export const DisconnectMessage = S.TaggedStruct("Disconnect", {})

export const TransportFailureMessage = S.TaggedStruct("TransportFailure", {
  cause: S.Unknown,
})

export declare namespace ActorMessage {
  export type Type<
    MethodDefinitions extends Record<string, MethodDefinition.Any>,
    EventDefinitions extends FieldsRecord,
  > =
    | typeof AuditionSuccessMessage.Type
    | typeof AuditionFailureMessage.Type
    | SuccessMessage.Type<MethodDefinitions>
    | FailureMessage.Type<MethodDefinitions>
    | EventMessage.Type<EventDefinitions>
    | typeof DisconnectMessage.Type

  export type Encoded<
    MethodDefinitions extends Record<string, MethodDefinition.Any>,
    EventDefinitions extends FieldsRecord,
  > =
    | typeof AuditionSuccessMessage.Encoded
    | typeof AuditionFailureMessage.Encoded
    | SuccessMessage.Encoded<MethodDefinitions>
    | FailureMessage.Encoded<MethodDefinitions>
    | EventMessage.Encoded<EventDefinitions>
    | typeof DisconnectMessage.Type
}
