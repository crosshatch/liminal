import type { WorkerProps } from "alchemy/Cloudflare"
import { Stage } from "alchemy/Stage"
import { Effect } from "effect"

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
    ...(stage === "prod" ? { domain: [domain, `www.${domain}`] } : {}),
    compatibility: {
      date: "2026-02-05",
      flags: ["nodejs_compat", "global_fetch_strictly_public"],
    },
    ...(assets ? { rootDir: assets } : {}),
  } satisfies Partial<WorkerProps>
})
