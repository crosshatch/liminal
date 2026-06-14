import type { WorkerProps } from "alchemy/Cloudflare"
import { Effect } from "effect"

import { AlchemicalEnv } from "./AlchemicalEnv.ts"

export const WorkerConfig = Effect.fn(function* ({
  domain,
  assets,
}: {
  readonly domain: string
  readonly assets?: string | undefined
}) {
  const env = yield* AlchemicalEnv
  return {
    observability: { enabled: true },
    placement: { mode: "smart" },
    ...(env._tag === "Main"
      ? { domain: prepends(domain) }
      : env._tag === "Staging"
        ? { domain: prepends(`staging-${env.pr}.${domain}`) }
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
