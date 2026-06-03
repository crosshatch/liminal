import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Config, Context, Effect, Layer, pipe, String } from "effect"

export class GithubEnv extends Context.Service<GithubEnv>()("liminal-util/alchemicals/GithubEnv", {
  make: Config.all({
    PULL_REQUEST: Config.option(Config.number("PULL_REQUEST")),
    GITHUB_SHA: Config.string("GITHUB_SHA"),
    GITHUB_REPOSITORY_OWNER: Config.string("GITHUB_REPOSITORY_OWNER"),
    GITHUB_REPOSITORY_NAME: Config.string("GITHUB_REPOSITORY").pipe(
      Config.map((repository) => repository.split("/")[1]!),
    ),
  }).pipe(
    Effect.catchTags({
      ConfigError: () => Effect.undefined,
    }),
  ),
}) {
  static readonly layer = Layer.effect(this, this.make)
}

export const commentPr =
  (resourceId: string) =>
  <Args extends Array<any>>(
    template: TemplateStringsArray,
    ...args: Args
  ): Output.All<Args> extends Output.Output<any, (infer Req) | GitHub.Providers>
    ? Output.Output<string, Req | GitHub.Providers>
    : never =>
    pipe(
      Output.interpolate(template, ...args),
      Output.map(String.stripMargin),
      Output.mapEffect(
        Effect.fn(
          function* (body) {
            const { GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY_NAME, PULL_REQUEST } = yield* GithubEnv.pipe(
              Effect.flatMap(Effect.fromNullishOr),
            )
            yield* GitHub.Comment(resourceId, {
              owner: GITHUB_REPOSITORY_OWNER,
              repository: GITHUB_REPOSITORY_NAME,
              issueNumber: yield* Effect.fromOption(PULL_REQUEST),
              body,
            })
          },
          Effect.catchTags({
            NoSuchElementError: Effect.die,
          }),
        ),
      ),
    ) as never
