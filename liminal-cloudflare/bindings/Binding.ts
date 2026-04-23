import { env } from "cloudflare:workers"
import { Context, Layer, Effect, Schema as S, SchemaIssue } from "effect"

export const layer =
  <Self, Identifier extends string, Shape, ROut = never, E = never, RIn = never>(
    tag: Context.ServiceClass<Self, Identifier, Shape>,
    keys: ReadonlyArray<string>,
    derive?: (resource: Shape) => Layer.Layer<ROut, E, RIn> | undefined,
  ) =>
  (binding: string) =>
    Effect.gen(function* () {
      const resolved = (env as never)[binding]
      if (!resolved) {
        return yield* Effect.fail(
          new S.SchemaError(
            new SchemaIssue.Pointer(
              [binding],
              new SchemaIssue.MissingKey({
                messageMissingKey: `Missing binding "${binding}" on env`,
              }),
            ),
          ),
        )
      }
      for (const key of keys) {
        if (!(key in resolved)) {
          return yield* Effect.fail(
            new S.SchemaError(
              new SchemaIssue.Pointer(
                [key],
                new SchemaIssue.MissingKey({
                  messageMissingKey: `Expected key \`${key}\` on binding \`${binding}\``,
                }),
              ),
            ),
          )
        }
      }
      return Layer.mergeAll(Layer.succeed(tag, resolved), derive?.(resolved) ?? Layer.empty)
    }).pipe(Layer.unwrap)
