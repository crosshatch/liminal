import { Record, Effect } from "effect"

import type { FError } from "./errors.ts"
import type { MethodDefinition } from "./Method.ts"

export type F<ClientSelf, MethodDefinitions extends Record<string, MethodDefinition.Any>> = <
  Method extends keyof MethodDefinitions,
>(
  method: Method,
) => (
  payload: MethodDefinitions[Method]["payload"]["Type"],
) => Effect.Effect<MethodDefinitions[Method]["success"]["Type"], FError<MethodDefinitions>, ClientSelf>
