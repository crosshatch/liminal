import * as Alchemy from "alchemy"
import * as Build from "alchemy/Build"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"
import { workerCommon } from "liminal-util/alchemy/workerCommon"

export default Alchemy.Stack(
  "liminal-tictactoe-example",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const { outdir: path, hash } = yield* Build.Command("Build", {
      cwd: "examples/tictactoe/app",
      command: "pnpm build",
      outdir: "dist",
    })
    return yield* Cloudflare.Worker("Worker", {
      ...workerCommon,
      main: "./api/main.ts",
      assets: {
        path,
        hash,
        config: { notFoundHandling: "single-page-application" },
      },
      env: {
        BUCKET: Cloudflare.R2Bucket("Bucket"),
        TICTACTOE: Cloudflare.DurableObjectNamespace("TicTacToeRuntime", {
          className: "TicTacToeRuntime",
        }),
      },
      domain: ["tictactoe.liminal.actor", "www.tictactoe.liminal.actor"],
    })
  }),
)
