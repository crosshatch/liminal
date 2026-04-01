import { Prompt, Chat } from "@effect/ai"
import { Effect, flow, Ref } from "effect"

export const append = (message: Prompt.Message) =>
  Chat.Chat.pipe(
    Effect.flatMap(
      flow(
        ({ history }) => history,
        Ref.update(({ content }) => Prompt.fromMessages([...content, message])),
      ),
    ),
  )
