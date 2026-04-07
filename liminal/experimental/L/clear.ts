import { Chat, Prompt } from "@effect/ai"
import { Ref, Effect } from "effect"

export const clear = Effect.gen(function* () {
  const { history } = yield* Chat.Chat
  yield* Ref.update(history, () => Prompt.empty)
})
