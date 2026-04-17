import { Effect, flow, Ref } from "effect"
import { Prompt, Chat } from "effect/unstable/ai"

export const append = (message: Prompt.Message) =>
  Chat.Chat.asEffect().pipe(
    Effect.flatMap(
      flow(
        ({ history }) => history,
        Ref.update(({ content }) => Prompt.fromMessages([...content, message])),
      ),
    ),
  )
