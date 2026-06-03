import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Effect, Layer, Option, String } from "effect"
import { GithubEnv } from "liminal-util/alchemicals/GithubEnv"
import { WorkerConfig } from "liminal-util/alchemicals/WorkerConfig"

export default Alchemy.Stack(
  "liminal-docs",
  {
    state: Cloudflare.state(),
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
  },
  Effect.gen(function* () {
    const { GITHUB_SHA, PULL_REQUEST } = yield* GithubEnv
    const pr = Option.getOrUndefined(PULL_REQUEST)
    const { url } = yield* Cloudflare.StaticSite("Docs", {
      ...WorkerConfig({ domain: "liminal.actor" }),
      command: "vocs build",
      outdir: "dist",
      script: String.stripMargin(`
      | export default {
      |   fetch: (request, env) => env.ASSETS.fetch(request),
      | };
      `),
    })
    if (pr !== undefined) {
      yield* GitHub.Comment("PreviewComment", {
        owner: "crosshatch",
        repository: "liminal",
        issueNumber: pr,
        body: Output.interpolate`
          ## Docs Preview

          URL: ${url}

          Commit: ${GITHUB_SHA.slice(0, 7)!}
        `,
      })
    }
  }).pipe(Effect.provide(GithubEnv.layer)),
)
