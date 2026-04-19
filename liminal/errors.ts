import { Schema as S } from "effect"

import type { ProtocolDefinition } from "./Protocol.ts"

export class AuditionError extends S.TaggedErrorClass<AuditionError>()("AuditionError", {
  value: S.Struct({
    client: S.String,
    routed: S.String,
  }).pipe(S.optional),
}) {}

export class ConnectionError extends S.TaggedErrorClass<ConnectionError>()("ConnectionError", {
  cause: S.Unknown,
}) {}

export type ClientError = AuditionError | ConnectionError

export class UnresolvedError extends S.TaggedErrorClass<UnresolvedError>()("UnresolvedError", {}) {}

export type FError<D extends ProtocolDefinition> = [
  D["methods"][keyof D["methods"]]["failure"]["Type"] | ClientError | UnresolvedError,
][0]
