import { Effect, Schema as S } from "effect"

import type { Protocol, ProtocolDefinition } from "./Protocol.ts"

export interface ActorTransport<Client, AttachmentFields extends S.Struct.Fields, D extends ProtocolDefinition> {
  readonly send: (
    client: Client,
    event: Protocol<D>["Event"]["Type"],
  ) => Effect.Effect<void, S.SchemaError, Protocol<D>["Event"]["EncodingServices"]>

  readonly close: (client: Client) => Effect.Effect<void>

  readonly snapshot: (
    client: Client,
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<void, S.SchemaError, S.Struct<AttachmentFields>["EncodingServices"]>
}
