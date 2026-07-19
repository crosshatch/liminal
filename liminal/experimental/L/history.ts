import { flow, Effect, Ref, Struct } from "effect"
import { Chat } from "effect/unstable/ai"

export const history = Chat.Chat.pipe(Effect.flatMap(flow(Struct.get("history"), Ref.get)))
