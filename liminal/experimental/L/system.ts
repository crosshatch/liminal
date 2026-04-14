import { Prompt } from "effect/unstable/ai"

import { append } from "./append.ts"

export const system = (text: string) => append(Prompt.systemMessage({ content: text }))
