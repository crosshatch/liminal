import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"

export default Alchemy.Stack(
  "liminal-docs",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Cloudflare.StaticSite("App", {
    command: "pnpm build",
    outdir: "dist",
    main: "docs/main.ts",
    compatibility: { date: "2026-04-08" },
    observability: { enabled: true },
    assetsConfig: { notFoundHandling: "single-page-application" },
    domain: ["liminal.actor", "www.liminal.actor"],
  }),
)
