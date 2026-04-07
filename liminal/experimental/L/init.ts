import { Chat } from "@effect/ai"
import { Effect } from "effect"

export const init = Effect.provideServiceEffect(Chat.Chat, Chat.empty)
