import * as Cloudflare from "alchemy/Cloudflare"

export const LiminalDocs = Cloudflare.StaticSite("LiminalDocs", {
  name: "liminal-docs",
  cwd: "docs",
  command: "pnpm build",
  outdir: "dist",
  main: "docs/main.ts",
  compatibility: { date: "2026-04-08" },
  observability: { enabled: true },
  assetsConfig: { notFoundHandling: "single-page-application" },
  domain: ["liminal.actor", "www.liminal.actor"],
})
