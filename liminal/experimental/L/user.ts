import { Prompt } from "effect/unstable/ai"

import { append } from "./append.ts"

export const user = (text: string) =>
  append(
    Prompt.userMessage({
      content: [Prompt.textPart({ text })],
    }),
  )
