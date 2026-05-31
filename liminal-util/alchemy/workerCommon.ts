import type { WorkerProps } from "alchemy/Cloudflare"

export const workerCommon = {
  compatibility: {
    date: "2026-02-05",
    flags: ["nodejs_compat", "global_fetch_strictly_public"],
  },
  observability: { enabled: true },
  placement: { mode: "smart" },
} satisfies Partial<WorkerProps>
