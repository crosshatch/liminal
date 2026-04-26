import { Effect } from "effect"

import type { FError } from "./errors.ts"
import type { ProtocolDefinition } from "./Protocol.ts"

export type F<Self, D extends ProtocolDefinition> = <Method extends keyof D["methods"]>(
  method: Method,
) => (
  payload: D["methods"][Method]["payload"]["Type"],
) => Effect.Effect<D["methods"][Method]["success"]["Type"], FError<D>, Self>
