import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import { Effect, Layer, String } from "effect"
import { GithubEnv, commentPr } from "liminal-util/alchemicals/GithubEnv"
import { WorkerConfig } from "liminal-util/alchemicals/WorkerConfig"

export default Alchemy.Stack(
  "liminal-docs",
  {
    state: Cloudflare.state(),
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
  },
  Effect.gen(function* () {
    const { url } = yield* Cloudflare.StaticSite("Docs", {
      ...(yield* WorkerConfig({
        domain: "liminal.actor",
      })),
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
        yield* commentPr("PreviewComment")`
        | ## Docs Preview
        |
        | URL: ${url}
        |
        | Commit: ${GITHUB_SHA.slice(0, 7)!}
        `
      }
    }
    return { url }
  }).pipe(Effect.provide(GithubEnv.layer)),
)
