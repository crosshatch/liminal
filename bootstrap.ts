import { GithubDeployer } from "@crosshatch/alchemy"
import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Github from "alchemy/GitHub"
import { Layer } from "effect"

export default Alchemy.Stack(
  "github-crosshatch-liminal",
  {
    state: Cloudflare.state(),
    providers: Layer.mergeAll(Github.providers(), Cloudflare.providers()),
  },
  GithubDeployer({
    owner: "crosshatch",
    repository: "liminal",
  }),
)
