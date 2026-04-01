import { Prompt, LanguageModel } from "@effect/ai"
import { Effect } from "effect"

import { append } from "./append.ts"
import { history } from "./history.ts"

export const assistant = Effect.gen(function* () {
  const prompt = yield* history
  const { text } = yield* LanguageModel.generateText({ prompt })
  yield* append(
    Prompt.assistantMessage({
      content: [Prompt.textPart({ text })],
    }),
  )
  return text
})
