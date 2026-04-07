import { Schema as S } from "effect"

import type { FieldsRecord } from "./_types.ts"
import type { MethodDefinition } from "./Method.ts"

export declare namespace Call {
  export namespace Payload {
    export type Type<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
      readonly _tag: "Call.Payload"

      readonly id: number

      readonly payload: {
        [K in keyof MethodDefinitions]: {
          readonly _tag: K
          readonly value: S.Struct<MethodDefinitions[K]["payload"]>["Type"]
        }
      }[keyof MethodDefinitions]
    }

    export type Encoded<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
      readonly _tag: "Call.Payload"

      readonly id: number

      readonly payload: {
        [K in keyof MethodDefinitions]: {
          readonly _tag: K
          readonly value: S.Struct<MethodDefinitions[K]["payload"]>["Encoded"]
        }
      }[keyof MethodDefinitions]
    }
  }

  export namespace Success {
    export type Type<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
      readonly _tag: "Call.Success"

      readonly id: number

      readonly value: {
        readonly [K in keyof MethodDefinitions]: {
          readonly _tag: K
          readonly value: MethodDefinitions[K]["success"]["Type"]
        }
      }[keyof MethodDefinitions]
    }

    export type Encoded<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
      readonly _tag: "Call.Success"

      readonly id: number

      readonly value: {
        readonly [K in keyof MethodDefinitions]: {
          readonly _tag: K
          readonly value: MethodDefinitions[K]["success"]["Encoded"]
        }
      }[keyof MethodDefinitions]
    }
  }

  export namespace Failure {
    export type Type<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
      readonly _tag: "Call.Failure"

      readonly id: number

      readonly cause: {
        readonly [K in keyof MethodDefinitions]: {
          readonly _tag: K
          readonly value: MethodDefinitions[K]["failure"]["Type"]
        }
      }[keyof MethodDefinitions]
    }

    export type Encoded<MethodDefinitions extends Record<string, MethodDefinition.Any>> = {
      readonly _tag: "Call.Failure"

      readonly id: number

      readonly cause: {
        readonly [K in keyof MethodDefinitions]: {
          readonly _tag: K
          readonly value: MethodDefinitions[K]["failure"]["Encoded"]
        }
      }[keyof MethodDefinitions]
    }
  }
}

export declare namespace Event {
  export type Type<EventDefinitions extends FieldsRecord> = {
    readonly _tag: "Event"

    readonly event: FieldsRecord.TaggedMember.Type<EventDefinitions>
  }

  export type Encoded<EventDefinitions extends FieldsRecord> = {
    readonly _tag: "Event"

    readonly event: FieldsRecord.TaggedMember.Encoded<EventDefinitions>
  }
}

export const Audition = {
  Success: S.TaggedStruct("Audition.Success", {}),
  Failure: S.TaggedStruct("Audition.Failure", {
    expected: S.String,
    actual: S.String,
  }),
}

export const Disconnect = S.TaggedStruct("Disconnect", {})

export const TransportFailure = S.TaggedStruct("TransportFailure", {
  cause: S.Unknown,
})

export declare namespace Actor {
  export type Type<
    MethodDefinitions extends Record<string, MethodDefinition.Any>,
    EventDefinitions extends FieldsRecord,
  > =
    | typeof Audition.Success.Type
    | typeof Audition.Failure.Type
    | Call.Success.Type<MethodDefinitions>
    | Call.Failure.Type<MethodDefinitions>
    | Event.Type<EventDefinitions>
    | typeof Disconnect.Type

  export type Encoded<
    MethodDefinitions extends Record<string, MethodDefinition.Any>,
    EventDefinitions extends FieldsRecord,
  > =
    | typeof Audition.Success.Encoded
    | typeof Audition.Failure.Encoded
    | Call.Success.Encoded<MethodDefinitions>
    | Call.Failure.Encoded<MethodDefinitions>
    | Event.Encoded<EventDefinitions>
    | typeof Disconnect.Type
}
