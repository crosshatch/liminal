import { Config, Context, Layer } from "effect"

export class GithubEnv extends Context.Service<GithubEnv>()("liminal-util/alchemicals/GithubEnv", {
  make: Config.all({
    PULL_REQUEST: Config.option(Config.number("PULL_REQUEST")),
    GITHUB_SHA: Config.string("GITHUB_SHA"),
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}
