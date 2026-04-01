import { Prompt } from "@effect/ai"

import { append } from "./append.ts"

export const system = (text: string) => append(Prompt.systemMessage({ content: text }))
