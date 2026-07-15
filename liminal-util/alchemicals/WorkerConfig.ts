import type { WorkerProps } from "alchemy/Cloudflare"
import { Stage } from "alchemy/Stage"
import { Effect } from "effect"

export const domain = (domain: string) =>
  Stage.pipe(
    Effect.map((stage) =>
      stage === "prod" ? prepends(domain) : stage.startsWith("staging-") ? prepends(`${stage}.${domain}`) : undefined,
    ),
  )

export const WorkerConfig = Effect.fn(function* ({
  domain,
  assets,
}: {
  readonly domain: string
  readonly assets?: string | undefined
}) {
  const stage = yield* Stage
  return {
    observability: { enabled: true },
    placement: { mode: "smart" },
    ...(stage === "prod"
      ? { domain: prepends(domain) }
      : stage.startsWith("staging-")
        ? { domain: prepends(`${stage}.${domain}`) }
        : {}),
    compatibility: {
      date: "2026-02-05",
      flags: ["nodejs_compat", "global_fetch_strictly_public"],
    },
    ...(assets
      ? {
          rootDir: assets,
          assets: {
            notFoundHandling: "single-page-application",
            directory: "dist",
          },
        }
      : {}),
  } satisfies Partial<WorkerProps>
})

const prepends = (v: string) => [v, `www.${v}`]
