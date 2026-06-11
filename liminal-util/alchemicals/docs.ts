import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect, Predicate } from "effect"
import { AlchemicalEnv } from "liminal-util/alchemicals/AlchemicalEnv"
import { WorkerConfig } from "liminal-util/alchemicals/WorkerConfig"

import { PrComment } from "./PrComment.ts"

export const docs = Effect.fnUntraced(function* ({ domain }: { readonly domain: string }) {
  const base = yield* WorkerConfig({ domain })
  const { dev: DEV } = yield* Alchemy.AlchemyContext
  const { url } = yield* Cloudflare.StaticSite("Docs", {
    ...base,
    dev: { command: "pnpm exec vocs dev" },
    command: "pnpm exec vocs build",
    outdir: "dist/public",
    env: { DEV },
  })
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
