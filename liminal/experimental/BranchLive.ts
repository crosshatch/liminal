import { Chat } from "@effect/ai"
import { Effect, Layer } from "effect"

import { history } from "./L/history.ts"

export const BranchLive = Layer.effect(Chat.Chat, history.pipe(Effect.flatMap(Chat.fromPrompt)))
