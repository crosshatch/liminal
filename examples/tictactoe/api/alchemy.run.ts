import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"
import * as AlchemicalEnv from "liminal-util/alchemicals/AlchemicalEnv"
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
    const STAGE = yield* Alchemy.Stage
    const { url } = yield* Cloudflare.Vite("Entry", {
      ...base,
      dev: {
        host: "127.0.0.1",
        port: 4384,
        strictPort: true,
      },
      env: {
        STAGE,
        VITE_PUBLIC_STAGE: STAGE,
        BUCKET: Cloudflare.R2Bucket("Bucket"),
        TICTACTOE: Cloudflare.DurableObjectNamespace("TicTacToeRuntime", {
          className: "TicTacToeRuntime",
        }),
      },
    })
    return { url }
  }).pipe(Effect.provide(AlchemicalEnv.layer)),
)
