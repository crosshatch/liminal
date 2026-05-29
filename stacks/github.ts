import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import { Config, Effect, Layer, Redacted } from "effect"

export default Alchemy.Stack(
  "liminal-github",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const accountId = yield* Config.string("CLOUDFLARE_ACCOUNT_ID")
    const { value } = yield* Cloudflare.AccountApiToken("DeployApiToken", {
      name: "liminal-deploy",
      accountId,
      policies: [
        {
          effect: "allow",
          permissionGroups: [
            "Workers Scripts Write",
            "Workers KV Storage Write",
            "Workers R2 Storage Write",
            "D1 Write",
            "Queues Write",
            "Pages Write",
            "Account Settings Write",
            "Secrets Store Write",
            "Workers Tail Read",
          ],
          resources: {
            [`com.cloudflare.api.account.${accountId}`]: "*",
          },
        },
      ],
    })
    yield* GitHub.Secrets({
      owner: "crosshatch",
      repository: "liminal",
      environment: "deploy",
      secrets: {
        CLOUDFLARE_API_TOKEN: value,
        CLOUDFLARE_ACCOUNT_ID: Redacted.make(accountId),
      },
    })
  }).pipe(Effect.orDie),
)
