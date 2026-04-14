import { Effect, Schema as S } from "effect"
import { Prompt, LanguageModel } from "effect/unstable/ai"

import { append } from "./append.ts"
import { history } from "./history.ts"

export const assistantSchema = Effect.fnUntraced(function* <A, I extends Record<string, unknown>, R>(
  schema: S.Codec<A, I, R>,
) {
  const prompt = yield* history
  const { text, value } = yield* LanguageModel.generateObject({ prompt, schema })
  yield* append(
    Prompt.assistantMessage({
      content: [Prompt.textPart({ text })],
    }),
  )
  return value
})
