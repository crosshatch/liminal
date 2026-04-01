import { Chat } from "@effect/ai"
import { flow, Effect, Ref } from "effect"

export const history = Chat.Chat.pipe(Effect.flatMap(flow(({ history }) => history, Ref.get)))
