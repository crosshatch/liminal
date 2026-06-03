import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Array, flow, Config, Context, Data, Effect, Layer, String } from "effect"

export class GithubEnv extends Context.Service<GithubEnv>()("liminal-util/alchemicals/GithubEnv", {
  make: Config.all({
    PULL_REQUEST: Config.option(Config.number("PULL_REQUEST")),
    GITHUB_SHA: Config.string("GITHUB_SHA"),
    GITHUB_REPOSITORY_OWNER: Config.string("GITHUB_REPOSITORY_OWNER"),
    GITHUB_REPOSITORY_NAME: Config.string("GITHUB_REPOSITORY").pipe(
      Config.mapOrFail(
        flow(
          String.split("/"),
          Array.head,
          Effect.fromOption,
          Effect.catchTags({
            NoSuchElementError: Effect.die,
          }),
        ),
      ),
    ),
  }).pipe(
    Effect.catchTags({
      ConfigError: () => Effect.undefined,
    }),
  ),
}) {
  static readonly layer = Layer.effect(this, this.make)
}

export class NotInPrError extends Data.TaggedError("NotInPrError")<{}> {}

export const PrComment =
  (resourceId: string) =>
  <Args extends Array<any>>(template: TemplateStringsArray, ...args: Args) =>
    Effect.gen(function* () {
      const { GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY_NAME, PULL_REQUEST } = yield* GithubEnv.pipe(
        Effect.flatMap(Effect.fromNullishOr),
      )
      return yield* GitHub.Comment(resourceId, {
        owner: GITHUB_REPOSITORY_OWNER,
        repository: GITHUB_REPOSITORY_NAME,
        issueNumber: yield* Effect.fromOption(PULL_REQUEST),
        body: Output.interpolate(template, ...args).pipe(Output.map(String.stripMargin)),
      })
    }).pipe(
      Effect.catchTags({
        NoSuchElementError: () => new NotInPrError(),
      }),
    )
