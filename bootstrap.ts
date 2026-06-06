import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Github from "alchemy/GitHub"
import { Layer, Effect } from "effect"
import { GithubDeployer } from "liminal-util/alchemicals/GithubDeployer"

export default Alchemy.Stack(
  "github-crosshatch-liminal",
  {
    state: Cloudflare.state(),
    providers: Layer.mergeAll(Github.providers(), Cloudflare.providers()),
  },
  Effect.gen(function* () {
    yield* GithubDeployer({
      owner: "crosshatch",
      repository: "liminal",
    })
  }),
)
