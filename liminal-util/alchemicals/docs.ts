import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"
import { WorkerConfig } from "liminal-util/alchemicals/WorkerConfig"

import { PrPreviewComment } from "./PrComment.ts"

export const docs = Effect.fnUntraced(function* ({
  domain,
  devPort,
}: {
  readonly domain: string
  readonly devPort: number
}) {
  const base = yield* WorkerConfig({ domain })
  const STAGE = yield* Alchemy.Stage
  const { url } = yield* Cloudflare.StaticSite("Docs", {
    ...base,
    dev: { command: `pnpm exec vocs dev --host 127.0.0.1 --port ${devPort}` },
    command: "pnpm exec vocs build",
    outdir: "dist/public",
    alwaysRun: true,
    env: {
      STAGE,
      VITE_PUBLIC_STAGE: STAGE,
    },
  })
  yield* PrPreviewComment({ name: "Docs", url })
  return { url }
})
