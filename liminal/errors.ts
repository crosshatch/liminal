import { Schema as S } from "effect"

import type { MethodDefinition } from "./Method.ts"

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

export class UnresolvedError extends S.TaggedError<UnresolvedError>()("UnresolvedError", {}) {}

export type FError<MethodDefinitions extends Record<string, MethodDefinition.Any>> = [
  MethodDefinitions[keyof MethodDefinitions]["failure"]["Type"] | ClientError | UnresolvedError,
][0]
