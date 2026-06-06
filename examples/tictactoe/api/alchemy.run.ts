import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"
import { WorkerConfig } from "liminal-util/alchemicals/WorkerConfig"

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
    const { url } = yield* Cloudflare.Vite("Entry", {
      ...base,
      env: {
        BUCKET: Cloudflare.R2Bucket("Bucket"),
        TICTACTOE: Cloudflare.DurableObjectNamespace("TicTacToeRuntime", {
          className: "TicTacToeRuntime",
        }),
      },
    })
    return { url }
  }),
)
