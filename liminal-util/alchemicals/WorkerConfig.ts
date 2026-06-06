import { Stage } from "alchemy"
import type { WorkerProps } from "alchemy/Cloudflare"

export const WorkerConfig = ({ domain, assets }: { readonly domain: string; readonly assets?: string | undefined }) =>
  Stage.useSync(
    (stage) =>
      ({
        observability: { enabled: true },
        placement: { mode: "smart" },
        ...(stage === "prod" ? { domain: [domain, `www.${domain}`] } : {}),
        compatibility: {
          date: "2026-02-05",
          flags: ["nodejs_compat", "global_fetch_strictly_public"],
        },
        ...(assets ? { rootDir: assets } : {}),
      }) satisfies Partial<WorkerProps>,
  )
