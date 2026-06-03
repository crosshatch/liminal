import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Effect, Layer, String } from "effect"
import { GithubEnv, WorkerConfig } from "liminal-util/alchemicals/config"

export default Alchemy.Stack(
  "liminal-docs",
  {
    state: Cloudflare.state(),
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
  },
  Effect.gen(function* () {
    const { GITHUB_SHA, PULL_REQUEST } = yield* GithubEnv
    const { url } = yield* Cloudflare.StaticSite("Docs", {
      ...WorkerConfig({
        domain: "liminal.actor",
      }),
      command: "vocs build",
      outdir: "dist",
      script: String.stripMargin(`
      | export default {
      |   fetch: (request, env) => env.ASSETS.fetch(request),
      | };
      `),
    })
    if (PULL_REQUEST) {
      yield* GitHub.Comment("PreviewComment", {
        owner: "crosshatch",
        repository: "liminal",
        issueNumber: PULL_REQUEST,
        body: Output.interpolate`
          ## Docs Preview

          URL: ${url}

          Commit: ${GITHUB_SHA.slice(0, 7)!}
        `,
      })
    }
  }).pipe(Effect.provide(GithubEnv.layer)),
)
