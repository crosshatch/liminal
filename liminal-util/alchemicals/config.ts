import type { WorkerProps } from "alchemy/Cloudflare"
import { Layer, Context, Config } from "effect"

export const WorkerConfig = ({ domain, assets }: { readonly domain: string; readonly assets?: string | undefined }) =>
  ({
    observability: { enabled: true },
    placement: { mode: "smart" },
    domain: [domain, `www.${domain}`],
    compatibility: {
      date: "2026-02-05",
      flags: ["nodejs_compat", "global_fetch_strictly_public"],
    },
    ...(assets ? { rootDir: assets } : {}),
  }) satisfies Partial<WorkerProps>

export class GithubEnv extends Context.Service<GithubEnv>()("liminal-util/alchemy_util/GithubEnv", {
  make: Config.all({
    PULL_REQUEST: Config.number("PULL_REQUEST"),
    GITHUB_SHA: Config.string("GITHUB_SHA"),
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}
