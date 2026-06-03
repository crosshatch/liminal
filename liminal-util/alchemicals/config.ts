import * as Alchemy from "alchemy"
import type { WorkerProps } from "alchemy/Cloudflare"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Drizzle from "alchemy/Drizzle"
import * as GitHub from "alchemy/GitHub"
import * as Planetscale from "alchemy/Planetscale"
import type { StackProps } from "alchemy/Stack"
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

const providers = Layer.mergeAll(
  Cloudflare.providers(),
  Planetscale.providers(),
  Drizzle.providers(),
  GitHub.providers(),
  GithubEnv.layer.pipe(Layer.orDie),
)

export const remote: StackProps<any> = {
  providers,
  state: Cloudflare.state(),
}
export const local: StackProps<any> = {
  providers,
  state: Alchemy.localState(),
}
