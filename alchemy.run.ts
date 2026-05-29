import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

import { LiminalDocs } from "./docs/alchemy.run.ts"

export default Alchemy.Stack(
  "liminal",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const docs = yield* LiminalDocs

    return {
      docsUrl: docs.url,
      docsDomains: docs.domains,
    }
  }),
)
