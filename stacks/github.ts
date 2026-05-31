import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import { Effect, Layer } from "effect"
import { github } from "liminal-util/alchemy/github"

export default Alchemy.Stack(
  "liminal-github",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Alchemy.localState(),
  },
  github({ repository: "liminal" }).pipe(Effect.orDie),
)
