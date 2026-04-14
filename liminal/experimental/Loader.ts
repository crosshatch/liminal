import { Path, FileSystem } from "effect"
import { Option, Layer, Effect, Data, Context } from "effect"

export class LoaderError extends Data.TaggedError("LoaderError")<{
  readonly url: string
}> {}

export class Loader extends Context.Service<
  Loader,
  {
    readonly load: (key: string) => Effect.Effect<Option.Option<string>, LoaderError>
  }
>()("liminal/Loader") {}

export const layerFs = Layer.effect(
  Loader,
  Effect.gen(function* () {
    const path = yield* Path.Path
    const fs = yield* FileSystem.FileSystem

    const load = Effect.fnUntraced(function* (url: string) {
      const { dir, name } = path.parse(new URL(url).pathname)
      const templatePathname = path.join(dir, `${name}.md`)
      if (yield* fs.exists(templatePathname).pipe(Effect.mapError(() => new LoaderError({ url })))) {
        return yield* fs.readFileString(templatePathname).pipe(
          Effect.map(Option.some),
          Effect.mapError(() => new LoaderError({ url })),
        )
      }
      return Option.none()
    })

    return { load }
  }),
)
