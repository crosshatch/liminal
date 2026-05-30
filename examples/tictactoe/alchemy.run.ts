import * as Build from "alchemy/Build"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"

export const TicTacToe = Effect.gen(function* () {
  const app = yield* Build.Command("Build", {
    cwd: "examples/tictactoe/app",
    command: "pnpm build",
    outdir: "dist",
  })

  const bucket = yield* Cloudflare.R2Bucket("Bucket", {
    name: "liminal-tictactoe",
  })

  const namespace = Cloudflare.DurableObjectNamespace("TicTacToeRuntime", {
    className: "TicTacToeRuntime",
  })

  return yield* Cloudflare.Worker("Worker", {
    name: "tictactoe",
    main: "examples/tictactoe/api/main.ts",
    compatibility: {
      date: "2026-02-05",
      flags: ["nodejs_compat", "global_fetch_strictly_public"],
    },
    observability: { enabled: true },
    placement: { mode: "smart" },
    assets: {
      path: app.outdir,
      hash: app.hash,
      config: { notFoundHandling: "single-page-application" },
    },
    bindings: {
      BUCKET: bucket,
      TICTACTOE: namespace,
    },
    domain: ["tictactoe.liminal.actor", "www.tictactoe.liminal.actor"],
  })
})
