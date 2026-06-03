import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Effect } from "effect"
import { WorkerConfig, remote, GithubEnv } from "liminal-util/alchemicals/config"

export default Alchemy.Stack(
  "liminal-docs",
  remote,
  Effect.gen(function* () {
    const { GITHUB_SHA, PULL_REQUEST } = yield* GithubEnv
    const { url } = yield* Cloudflare.StaticSite("Docs", {
      ...WorkerConfig({
        domain: "liminal.actor",
      }),
      command: "vocs build",
      outdir: "dist",
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
  }),
)
