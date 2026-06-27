import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import { Effect, Config } from "effect"

export const GithubDeployer = Effect.fn(function* ({
  owner,
  repository,
}: {
  readonly owner: string
  readonly repository: string
}) {
  const accountId = yield* Config.string("CLOUDFLARE_ACCOUNT_ID")
  const { value: apiToken } = yield* Cloudflare.ApiToken.AccountApiToken("DeployApiToken", {
    accountId,
    policies: [
      {
        effect: "allow",
        // oxfmt-ignore
        permissionGroups: ["Account Settings Write", "AI Gateway Write", "D1 Write", "Hyperdrive Write", "Pages Write", "Queues Write", "Secrets Store Write", "Vectorize Write", "Workers KV Storage Write", "Workers R2 Storage Write", "Workers Scripts Read", "Workers Scripts Write", "Workers Tail Read"],
        resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
      },
      {
        effect: "allow",
        permissionGroups: ["DNS Write", "Workers Routes Write", "Zone Read"],
        resources: {
          [`com.cloudflare.api.account.${accountId}`]: { "com.cloudflare.api.account.zone.*": "*" },
        },
      },
    ],
  })
  yield* GitHub.Variable("CloudflareAccountId", {
    owner,
    repository,
    name: "CLOUDFLARE_ACCOUNT_ID",
    value: accountId,
  })
  yield* GitHub.Secret("CloudflareApiToken", {
    owner,
    repository,
    name: "CLOUDFLARE_API_TOKEN",
    value: apiToken,
  })
})
