import { Ref, Effect } from "effect"
import { Chat, Prompt } from "effect/unstable/ai"

export const clear = Effect.gen(function* () {
  const { history } = yield* Chat.Chat
  yield* Ref.update(history, () => Prompt.empty)
})
