import * as Cloudflare from "alchemy/Cloudflare"
import { Effect, String } from "effect"
import { GithubEnv, PrComment } from "liminal-util/alchemicals/GithubEnv"
import { WorkerConfig } from "liminal-util/alchemicals/WorkerConfig"

export const docs = Effect.fnUntraced(function* ({ domain }: { readonly domain: string }) {
  const { url } = yield* Cloudflare.StaticSite("Docs", {
    ...(yield* WorkerConfig({ domain })),
    command: "vocs build",
    outdir: "dist",
    dev: { command: "vocs dev" },
    script: String.stripMargin(`
    | export default {
    |   fetch: (request, env) => env.ASSETS.fetch(request),
    | };
    `),
  })
  const githubEnv = yield* GithubEnv
  if (githubEnv) {
    const { GITHUB_SHA, PULL_REQUEST } = githubEnv
    if (PULL_REQUEST._tag === "Some") {
      yield* PrComment("PreviewComment")`
      | ## Docs Preview
      |
      | URL: ${url}
      |
      | Commit: ${GITHUB_SHA.slice(0, 7)!}
      `.pipe(
        Effect.catchTags({
          NotInPrError: Effect.succeed,
        }),
      )
    }
  }
  return { url }
})
