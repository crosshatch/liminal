import { env } from "cloudflare:workers"
import { Data, Context, Layer, Effect, Schema as S } from "effect"

export class BindingError extends Data.TaggedError("BindingError")<{
  readonly binding: string
}> {}

export const layer =
  <Self, Identifier extends string, Shape, T extends S.Top, ROut = never, E = never, RIn = never>(
    tag: Context.ServiceClass<Self, Identifier, Shape>,
    schema: T,
    derive?: (resource: Shape) => Layer.Layer<ROut, E, RIn> | undefined,
  ) =>
  (binding: string) => {
    const validate = S.decodeUnknownEffect(S.toType(schema))
    return Effect.gen(function* () {
      const resolved = (yield* Effect.fromNullishOr((env as never)[binding]).pipe(
        Effect.catchTag("NoSuchElementError", () => new BindingError({ binding }).asEffect()),
        Effect.flatMap(validate),
      )) as Shape
      return Layer.mergeAll(Layer.succeed(tag, resolved), derive?.(resolved) ?? Layer.empty)
    }).pipe(Layer.unwrap)
  }
