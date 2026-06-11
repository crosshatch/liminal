import * as Alchemy from "alchemy"
import { Option, Array, flow, Config, Context, Effect, Layer, String, Data } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"

type GithubEnv = {
  readonly sha: string
  readonly owner: string
  readonly repository: string
}

export class AlchemicalEnv extends Context.Service<
  AlchemicalEnv,
  Data.TaggedEnum<{
    Local: {}
    Pr: { pr: number } & GithubEnv
    Main: {} & GithubEnv
  }> & {
    readonly branch: string
  }
>()("liminal-util/alchemicals/AlchemicalEnv") {}

const make = Data.taggedEnum<AlchemicalEnv["Service"]>()

export const layer = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const branch = yield* ChildProcess.make("git", ["branch", "--show-current"]).pipe(
    spawner.string,
    Effect.map(String.trim),
    Effect.catchTags({
      PlatformError: Effect.die,
    }),
  )
  const devLike = yield* Config.boolean("ALCHEMICAL_DEV").pipe(Config.withDefault(false))
  const { dev } = yield* Alchemy.AlchemyContext
  if (devLike || dev) {
    return make.Local({ branch })
  }
  const github = yield* Config.all({
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
  const { pr, ...rest } = github
  return pr ? make.Pr({ branch, pr, ...rest }) : make.Main({ branch, ...rest })
}).pipe(Layer.effect(AlchemicalEnv))
