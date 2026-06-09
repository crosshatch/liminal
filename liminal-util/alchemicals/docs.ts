import * as Cloudflare from "alchemy/Cloudflare"
import { Effect, Predicate } from "effect"
import { AlchemicalEnv } from "liminal-util/alchemicals/AlchemicalEnv"
import { WorkerConfig } from "liminal-util/alchemicals/WorkerConfig"

import { PrComment } from "./PrComment.ts"

export const docs = Effect.fnUntraced(function* ({ domain }: { readonly domain: string }) {
  const base = yield* WorkerConfig({ domain })
  const { url } = yield* Cloudflare.Vite("Docs", base)
  const env = yield* AlchemicalEnv
  if (env._tag === "Pr") {
    const { pr, sha } = env
    if (Predicate.isNumber(pr)) {
      yield* PrComment("PreviewComment")`
      | ## Docs Preview
      |
      | URL: ${url}
      |
      | Commit: ${sha}
      `.pipe(
        Effect.catchTags({
          NotInPrError: Effect.die,
        }),
      )
    }
  }
  return { url }
})
