import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"
import { WorkerConfig } from "liminal-util/alchemicals/WorkerConfig"

import { PrPreviewComment } from "./PrComment.ts"

export const docs = Effect.fnUntraced(function* ({ domain }: { readonly domain: string }) {
  const base = yield* WorkerConfig({ domain })
  const { dev: DEV } = yield* Alchemy.AlchemyContext
  const { url } = yield* Cloudflare.StaticSite("Docs", {
    ...base,
    dev: { command: "pnpm exec vocs dev" },
    command: "pnpm exec vocs build",
    outdir: "dist/public",
    env: { DEV },
  })
  yield* PrPreviewComment({ name: "Docs", url })
  return { url }
})
