import { Schema as S, Effect } from "effect"

import type { ProtocolDefinition, Disconnect, Protocol } from "./Protocol.ts"

export interface HandleEncoders<T, AttachmentFields extends S.Struct.Fields, D extends ProtocolDefinition> {
  readonly attachments: (
    value: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<T, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>

  readonly event: (
    value: Protocol<D>["Event"]["Type"],
  ) => Effect.Effect<T, S.SchemaError, Protocol<D>["Event"]["EncodingServices"]>

  readonly disconnect: Effect.Effect<T, S.SchemaError, (typeof Disconnect)["EncodingServices"]>
}
