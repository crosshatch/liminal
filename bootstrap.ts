import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Github from "alchemy/GitHub"
import { Layer } from "effect"
import { bootstrap } from "liminal-util/alchemicals/bootstrap"

export default Alchemy.Stack(
  "liminal-github",
  {
    state: Cloudflare.state(),
    providers: Layer.mergeAll(Github.providers(), Cloudflare.providers()),
  },
  bootstrap({
    repository: "liminal",
    environment: "deploy",
  }),
)
