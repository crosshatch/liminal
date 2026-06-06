import * as Cloudflare from "alchemy/Cloudflare"
import { Effect, Predicate, String } from "effect"
import { AlchemicalEnv } from "liminal-util/alchemicals/AlchemicalEnv"
import { WorkerConfig } from "liminal-util/alchemicals/WorkerConfig"

import { PrComment } from "./PrComment.ts"

export const docs = Effect.fnUntraced(function* ({ domain }: { readonly domain: string }) {
  const base = yield* WorkerConfig({ domain })
  const { url } = yield* Cloudflare.StaticSite("Docs", {
    ...base,
    command: "vocs build",
    outdir: "dist",
    dev: { command: "vocs dev" },
    script: String.stripMargin(`
    | export default {
    |   fetch: (request, env) => env.ASSETS.fetch(request),
    | };
    `),
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
