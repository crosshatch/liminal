import { Schema as S } from "effect"

export class AuditionError extends S.TaggedErrorClass<AuditionError>()("AuditionError", {
  value: S.Struct({
    expected: S.String,
    actual: S.String,
  }).pipe(S.optional),
}) {}

export class ConnectionError extends S.TaggedErrorClass<ConnectionError>()("ConnectionError", {
  cause: S.Unknown,
}) {}

export type ClientError = AuditionError | ConnectionError

export class UnresolvedError extends S.TaggedErrorClass<UnresolvedError>()("UnresolvedError", {}) {}
