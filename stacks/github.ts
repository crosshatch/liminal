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
    const { value: apiToken } = yield* Cloudflare.AccountApiToken("DeployApiToken", {
      name: "liminal-deploy",
      accountId,
      policies: [
        {
          effect: "allow",
          permissionGroups: [
            "Account Settings Write",
            "D1 Write",
            "Pages Write",
            "Queues Write",
            "Secrets Store Write",
            "Workers KV Storage Write",
            "Workers R2 Storage Write",
            "Workers Scripts Write",
            "Workers Tail Read",
          ],
          resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        },
        {
          effect: "allow",
          permissionGroups: ["DNS Write", "Zone Read"],
          resources: {
            [`com.cloudflare.api.account.${accountId}`]: {
              "com.cloudflare.api.account.zone.*": "*",
            } as never as string,
          },
        },
      ],
    })
    yield* GitHub.Secrets({
      owner: "crosshatch",
      repository: "liminal",
      environment: "deploy",
      secrets: {
        CLOUDFLARE_ACCOUNT_ID: Redacted.make(accountId),
        CLOUDFLARE_API_TOKEN: Redacted.make(apiToken),
      },
    })
  }).pipe(Effect.orDie),
)
