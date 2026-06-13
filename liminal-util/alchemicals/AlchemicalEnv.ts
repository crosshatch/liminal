import { AlchemyContext } from "alchemy/AlchemyContext"
import { Option, Array, flow, Config, Context, Effect, Layer, String, Data } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"

export class AlchemicalEnv extends Context.Service<
  AlchemicalEnv,
  Data.TaggedEnum<{
    Local: {}
    Pr: {
      readonly pr: number
      readonly sha: string
      readonly owner: string
      readonly repository: string
    }
    Main: {}
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
  const { dev } = yield* AlchemyContext
  if (dev) {
    return make.Local({ branch })
  }
  const pr = yield* Config.number("PULL_REQUEST").pipe(Config.option, Config.map(Option.getOrUndefined))
  if (!pr) {
    return make.Main({ branch })
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
  })
  return make.Pr({ branch, pr, ...github })
}).pipe(Layer.effect(AlchemicalEnv))
