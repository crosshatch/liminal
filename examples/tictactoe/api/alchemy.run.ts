import { WorkerConfig } from "@crosshatch/util/alchemicals/WorkerConfig"
import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"

export default Alchemy.Stack(
  "liminal-example-tictactoe",
  {
    state: Cloudflare.state(),
    providers: Cloudflare.providers(),
  },
  Effect.gen(function* () {
    const base = yield* WorkerConfig({
      domain: "tictactoe.liminal.actor",
      assets: "../app",
    })
    const STAGE = yield* Alchemy.Stage
    yield* Cloudflare.Website.Vite("Entry", {
      ...base,
      dev: {
        host: "127.0.0.1",
        port: 4387,
        strictPort: true,
      },
      env: {
        STAGE,
        VITE_PUBLIC_STAGE: STAGE,
        BUCKET: Cloudflare.R2.Bucket("Bucket"),
        TICTACTOE: Cloudflare.DurableObject("TicTacToeRuntime", {
          className: "TicTacToeRuntime",
        }),
      },
    })
  }),
)
