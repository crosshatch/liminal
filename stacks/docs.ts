import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Effect, Layer, Config } from "effect"
import { workerCommon } from "liminal-util/alchemy/workerCommon"

export default Alchemy.Stack(
  "liminal-docs",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const { STAGE, PULL_REQUEST, GITHUB_SHA } = yield* Config.all({
      STAGE: Config.string("STAGE"),
      PULL_REQUEST: Config.boolean("PULL_REQUEST"),
      GITHUB_SHA: Config.string("GITHUB_SHA"),
    })
    const site = yield* Cloudflare.StaticSite("Docs", {
      ...workerCommon,
      command: "pnpm build",
      outdir: "dist",
      main: "docs/main.ts",
      assetsConfig: { notFoundHandling: "single-page-application" },
      domain: STAGE === "prod" ? ["liminal.actor", "www.liminal.actor"] : [],
    })

    if (PULL_REQUEST) {
      yield* GitHub.Comment("PreviewComment", {
        owner: "crosshatch",
        repository: "liminal",
        issueNumber: Number(PULL_REQUEST),
        body: Output.interpolate`
          ## Docs Preview

          URL: ${site.url}

          Commit: ${GITHUB_SHA.slice(0, 7) ?? "unknown"}
        `,
      })
    }

    return site
  }).pipe(Effect.orDie),
)
