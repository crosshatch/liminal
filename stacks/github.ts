import * as Alchemy from "alchemy"
import * as GitHub from "alchemy/GitHub"
import { Config, Effect, Redacted } from "effect"

export default Alchemy.Stack(
  "liminal-github",
  {
    providers: GitHub.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const accountId = yield* Config.string("CLOUDFLARE_ACCOUNT_ID")
    const apiToken = yield* Config.string("CLOUDFLARE_API_TOKEN")
    yield* GitHub.Secrets({
      owner: "crosshatch",
      repository: "liminal",
      environment: "deploy",
      secrets: {
        CLOUDFLARE_API_TOKEN: Redacted.make(apiToken),
        CLOUDFLARE_ACCOUNT_ID: Redacted.make(accountId),
      },
    })
  }).pipe(Effect.orDie),
)
