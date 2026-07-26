import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"

import NexampleWorker from "./NexampleWorker.ts"

export default Alchemy.Stack(
  "liminext",
  {
    state: Cloudflare.state(),
    providers: Cloudflare.providers(),
  },
  Effect.gen(function* () {
    yield* NexampleWorker
  }),
)
