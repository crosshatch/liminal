import { Config, Effect, Path, Redacted, Stream } from "effect"
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
        yield* ChildProcess.make({
          cwd: worker,
          stdin: Stream.succeed(new TextEncoder().encode(Redacted.value(value))),
        })`pnpm wrangler secret put ${name}`.pipe(spawner.exitCode)
        yield* Effect.log(`Synced ${name} to ${worker}.`)
      }
    }),
  ),
)
