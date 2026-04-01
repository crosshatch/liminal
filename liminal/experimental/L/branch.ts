import { Effect } from "effect"

import { BranchLive } from "../BranchLive.ts"

export const branch = Effect.provide(BranchLive)
