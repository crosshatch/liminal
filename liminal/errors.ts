import { Schema as S } from "effect"

export class AuditionError extends S.TaggedError<AuditionError>()("AuditionError", {
  value: S.Struct({
    expected: S.String,
    actual: S.String,
  }).pipe(S.optional),
}) {}

export class ConnectionError extends S.TaggedError<ConnectionError>()("ConnectionError", {
  cause: S.Unknown,
}) {}

export type ClientError = AuditionError | ConnectionError

export class UnresolvedError extends S.TaggedError<UnresolvedError>()("UnresolvedError", {}) {}
