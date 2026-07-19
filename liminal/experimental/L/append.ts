import { Effect, flow, Ref, Struct } from "effect"
import { Prompt, Chat } from "effect/unstable/ai"

export const append = (message: Prompt.Message) =>
  Chat.Chat.pipe(
    Effect.flatMap(
      flow(
        Struct.get("history"),
        Ref.update(({ content }) => Prompt.fromMessages([...content, message])),
      ),
    ),
  )
