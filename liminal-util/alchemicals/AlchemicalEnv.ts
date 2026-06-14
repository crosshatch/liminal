import { AlchemyContext } from "alchemy/AlchemyContext"
import { Stage } from "alchemy/Stage"
import { Array, flow, Config, Context, Effect, Layer, String, Data } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"

export class AlchemicalEnv extends Context.Service<
  AlchemicalEnv,
  Data.TaggedEnum<{
    Local: {
      readonly branch: string
    }
    Staging: {
      readonly pr: number
      readonly sha: string
      readonly owner: string
      readonly repository: string
    }
    Main: {}
  }>
>()("liminal-util/alchemicals/AlchemicalEnv") {}

export const layer = Effect.gen(function* () {
  const stage = yield* Stage
  const { Main, Local, Staging } = Data.taggedEnum<AlchemicalEnv["Service"]>()
  if (stage === "prod") {
    return Main()
  }
  const { dev } = yield* AlchemyContext
  if (dev) {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const branch = yield* ChildProcess.make("git", ["branch", "--show-current"]).pipe(
      spawner.string,
      Effect.map(String.trim),
      Effect.catchTags({
        PlatformError: Effect.die,
      }),
    )
    return Local({ branch })
  }
  return yield* Config.all({
    pr: Config.number("PULL_REQUEST"),
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
  }).pipe(Effect.map(Staging))
}).pipe(Layer.effect(AlchemicalEnv))
