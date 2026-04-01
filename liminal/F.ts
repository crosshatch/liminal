import { Record, Effect, Schema as S } from "effect"

import type { ClientError } from "./errors.ts"
import type { MethodDefinition } from "./Method.ts"

export class UnresolvedError extends S.TaggedError<UnresolvedError>()("UnresolvedError", {}) {}

export type FError<MethodDefinitions extends Record<string, MethodDefinition.Any>> =
  | MethodDefinitions[keyof MethodDefinitions]["failure"]["Type"]
  | ClientError
  | UnresolvedError

export type F<ClientSelf, MethodDefinitions extends Record<string, MethodDefinition.Any>> = <
  Method extends keyof MethodDefinitions,
>(
  method: Method,
) => (
  payload: S.Struct<MethodDefinitions[Method]["payload"]>["Type"],
) => Effect.Effect<MethodDefinitions[Method]["success"]["Type"], FError<MethodDefinitions>, ClientSelf>
