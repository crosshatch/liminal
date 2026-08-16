import { Effect, flow, Ref } from "effect"
import { Prompt, Chat } from "effect/unstable/ai"

export const append = (message: Prompt.Message) =>
  Chat.Chat.pipe(
    Effect.flatMap(
      flow(
        (v) => v.history,
        Ref.update(({ content }) => Prompt.fromMessages([...content, message])),
      ),
    ),
  )
