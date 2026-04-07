import { Schema as S } from "effect"

export class AuditionError extends S.TaggedError<AuditionError>()("AuditionError", {
  value: S.Struct({
    actual: S.String,
    expected: S.String,
  }).pipe(S.optional),
}) {}

export class ConnectionError extends S.TaggedError<ConnectionError>()("ConnectionError", {
  cause: S.Unknown,
}) {}

export type ClientError = AuditionError | ConnectionError
