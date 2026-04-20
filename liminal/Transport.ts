import { Effect, Scope, Schema as S } from "effect"

import type { ClientError } from "./errors.ts"
import type { ProtocolDefinition, Protocol } from "./Protocol.ts"

export interface Transport<D extends ProtocolDefinition> {
  // TODO: propagate schema errors from message decoding and custom within take?
  readonly listen: (
    publish: (message: Protocol<D>["Actor"]["Type"]) => Effect.Effect<void, ClientError>,
  ) => Effect.Effect<void, ClientError | S.SchemaError, Scope.Scope | Protocol<D>["Actor"]["DecodingServices"]>

  readonly send: (
    message: Protocol<D>["F"]["Payload"]["Type"],
  ) => Effect.Effect<void, ClientError, Protocol<D>["F"]["Payload"]["EncodingServices"]>
}
