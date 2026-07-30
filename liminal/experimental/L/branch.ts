import { Effect } from "effect"

import { layer } from "../Branch.ts"

export const branch = Effect.provide(layer)
