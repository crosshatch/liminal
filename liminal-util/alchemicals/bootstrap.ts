import type { Input } from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import { Effect, Config, Redacted } from "effect"

const owner = "crosshatch"

export const bootstrap = Effect.fn(function* ({
  repository,
  variables,
  secrets,
}: {
  readonly repository: string
  readonly variables?: Record<string, Input<string>> | undefined
  readonly secrets?: Record<string, Input<string | Redacted.Redacted<string>>> | undefined
}) {
  const accountId = yield* Config.string("CLOUDFLARE_ACCOUNT_ID")
  const { value: apiToken } = yield* Cloudflare.AccountApiToken("DeployApiToken", {
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
          "Workers Scripts Read",
          "Workers Scripts Write",
          "Workers Tail Read",
        ],
        resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
      },
      {
        effect: "allow",
        permissionGroups: ["DNS Write", "Zone Read"],
        resources: {
          [`com.cloudflare.api.account.${accountId}`]: { "com.cloudflare.api.account.zone.*": "*" } as never,
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
  if (variables) {
    yield* GitHub.Variables({ owner, repository, variables })
  }
  if (secrets) {
    yield* GitHub.Secrets({ owner, repository, secrets })
  }
})
