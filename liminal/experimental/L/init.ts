import { Effect } from "effect"
import { Chat } from "effect/unstable/ai"

export const init = Effect.provideServiceEffect(Chat.Chat, Chat.empty)
