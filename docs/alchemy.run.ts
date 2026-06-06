import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import { Effect, Layer } from "effect"
import * as AlchemicalEnv from "liminal-util/alchemicals/AlchemicalEnv"
import { docs } from "liminal-util/alchemicals/docs"

export default Alchemy.Stack(
  "liminal-docs",
  {
    state: Cloudflare.state(),
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
  },
  docs({
    domain: "actor.liminal",
  }).pipe(Effect.provide(AlchemicalEnv.layer)),
)
