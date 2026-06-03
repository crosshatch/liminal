import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { remote, WorkerConfig } from "liminal-util/alchemicals/config"

export default Alchemy.Stack(
  "liminal-tictactoe-example",
  remote,
  Cloudflare.Vite("Entry", {
    ...WorkerConfig({
      domain: "tictactoe.liminal.actor",
      assets: "../app",
    }),
    env: {
      BUCKET: Cloudflare.R2Bucket("Bucket"),
      TICTACTOE: Cloudflare.DurableObjectNamespace("TicTacToeRuntime", {
        className: "TicTacToeRuntime",
      }),
    },
  }),
)
