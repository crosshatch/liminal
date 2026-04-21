import { Effect, Schema as S } from "effect"

import type { Disconnect, Protocol, ProtocolDefinition } from "./Protocol.ts"

export interface ActorTransport<Raw, AttachmentFields extends S.Struct.Fields, D extends ProtocolDefinition> {
  readonly send: (
    transport: Raw,
    event: Protocol<D>["Event"]["Type"] | typeof Disconnect.Type,
  ) => Effect.Effect<void, S.SchemaError, Protocol<D>["Event"]["EncodingServices"]>

  readonly close: (transport: Raw) => Effect.Effect<void>

  readonly snapshot: (
    transport: Raw,
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<void, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>
}
