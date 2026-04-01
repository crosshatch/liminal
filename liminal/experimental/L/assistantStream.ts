import { LanguageModel } from "@effect/ai"
import { Effect, Stream } from "effect"

import { history } from "./history.ts"

export const assistantStream = history.pipe(
  Effect.map((prompt) => LanguageModel.streamText({ prompt })),
  Stream.unwrap,
)
