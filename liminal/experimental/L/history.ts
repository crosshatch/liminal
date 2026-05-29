import { flow, Effect, Ref } from "effect"
import { Chat } from "effect/unstable/ai"

export const history = Chat.Chat.pipe(Effect.flatMap(flow(({ history }) => history, Ref.get)))
