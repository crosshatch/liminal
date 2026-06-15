import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Array, Config, Data, Effect, flow, Option, String } from "effect"

export class NotInPrError extends Data.TaggedError("NotInPrError")<{}> {}

export const GithubEnv = Config.boolean("GITHUB_ACTIONS").pipe(
  Config.withDefault(false),
  Config.mapOrFail((v) =>
    v
      ? Config.all({
          sha: Config.string("GITHUB_SHA"),
          owner: Config.string("GITHUB_REPOSITORY_OWNER"),
          repository: Config.string("GITHUB_REPOSITORY").pipe(
            Config.mapOrFail(
              flow(
                String.split("/"),
                Array.get(1),
                Effect.fromOption,
                Effect.catchTags({
                  NoSuchElementError: Effect.die,
                }),
              ),
            ),
          ),
          pr: Config.number("PULL_REQUEST").pipe(Config.option, Config.map(Option.getOrUndefined)),
        })
      : Config.succeed(undefined),
  ),
)

export const PrComment =
  (resourceId: string) =>
  <Args extends Array<any>>(template: TemplateStringsArray, ...args: Args) =>
    Effect.gen(function* () {
      const env = yield* GithubEnv
      if (env) {
        const { owner, repository, pr } = env
        if (!pr) {
          return yield* new NotInPrError()
        }
        return yield* GitHub.Comment(resourceId, {
          owner,
          repository,
          issueNumber: pr,
          body: Output.interpolate(template, ...args).pipe(Output.map(String.stripMargin)),
        })
      }
      return
    })

export const PrPreviewComment = Effect.fn(function* <R = never>({
  name,
  url,
}: {
  readonly name: string
  readonly url: string | undefined | Output.Output<string | undefined, R>
}) {
  const env = yield* GithubEnv
  if (env) {
    const { sha } = env
    yield* PrComment("PreviewComment")`
    | ### ${name} Preview
    |
    | commit: ${sha}
    |
    | url: ${url}
    `
  }
})
