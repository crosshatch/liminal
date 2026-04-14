import { Effect, Stream } from "effect"
import { LanguageModel } from "effect/unstable/ai"

import { history } from "./history.ts"

export const assistantStream = history.pipe(
  Effect.map((prompt) => LanguageModel.streamText({ prompt })),
  Stream.unwrap,
)
