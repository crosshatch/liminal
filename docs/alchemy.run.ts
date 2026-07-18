import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import { Layer } from "effect"
import { docs } from "liminal-util/alchemicals/docs"

import PackageJson from "./package.json" with { type: "json" }

export default Alchemy.Stack(
  "liminal-docs",
  {
    state: Cloudflare.state(),
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
  },
  docs({
    domain: PackageJson.name,
    devPort: 4389,
  }),
)
