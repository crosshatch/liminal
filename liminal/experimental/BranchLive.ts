import { Effect, Layer } from "effect"
import { Chat } from "effect/unstable/ai"

import { history } from "./L/history.ts"

export const BranchLive = Layer.effect(Chat.Chat, history.pipe(Effect.flatMap(Chat.fromPrompt)))
