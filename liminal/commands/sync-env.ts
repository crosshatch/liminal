import { Config, Effect, Path, Redacted } from "effect"
import { Argument, Command } from "effect/unstable/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"

export const syncEnv = Command.make("sync-env", {
  worker: Argument.directory("worker", { mustExist: true }),
  configFile: Argument.file("config-file", { mustExist: true }),
  configExport: Argument.string("config-export").pipe(Argument.withDefault("config")),
}).pipe(
  Command.withHandler(
    Effect.fn(function* ({ worker, configFile, configExport }) {
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const url = yield* path.toFileUrl(path.resolve(configFile))
      const module = yield* Effect.tryPromise(() => import(url.href))
      const config = module[configExport] as Config.Config<Record<string, Redacted.Redacted<string>>>
      const env = yield* config
      for (const [name, value] of Object.entries(env)) {
        yield* spawner.spawn(
          ChildProcess.make({
            stdout: "inherit",
            stderr: "inherit",
            cwd: worker,
          })`pnpm wrangler secret put ${name} ${Redacted.value(value)}`,
        )
        yield* Effect.log(`Synced ${name} to ${worker}.`)
      }
    }),
  ),
)
