import { Array, Config, Effect, flow, Option, String } from "effect"

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
