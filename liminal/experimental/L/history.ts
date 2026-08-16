import { Effect, Ref } from "effect"
import { Chat } from "effect/unstable/ai"

export const history = Chat.Chat.pipe(
  Effect.map((v) => v.history),
  Effect.flatMap(Ref.get),
)
