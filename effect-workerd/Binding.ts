import { Context, Layer, Effect, Schema as S, SchemaIssue } from "effect"
import * as Boundary from "liminal-util/Boundary"

import { Env } from "./Env.ts"

export const layer =
  <Self, Identifier extends string, Shape, ROut = never, E = never, RIn = never>(
    tag: Context.ServiceClass<Self, Identifier, Shape>,
    keys: ReadonlyArray<string>,
    derive?: (resource: Shape) => Layer.Layer<ROut, E, RIn> | undefined,
  ) =>
  (binding: string) =>
    Effect.gen(function* () {
      const env = yield* Env
      const resolved = env[binding]
      if (!resolved || typeof resolved !== "object" || resolved === null) {
        return yield* new S.SchemaError(
          new SchemaIssue.Pointer(
            [binding],
            new SchemaIssue.MissingKey({
              messageMissingKey: `Missing binding \`${binding}\` on env.`,
            }),
          ),
        )
      }
      for (const key of keys) {
        if (!(key in resolved)) {
          return yield* new S.SchemaError(
            new SchemaIssue.Pointer(
              [key],
              new SchemaIssue.MissingKey({
                messageMissingKey: `Expected key \`${key}\` on binding \`${binding}\`.`,
              }),
            ),
          )
        }
      }
      return Layer.mergeAll(Layer.succeed(tag, resolved as never), derive?.(resolved as never) ?? Layer.empty)
    }).pipe(
      Boundary.span("make-binding", import.meta.url, {
        attributes: { id: tag.key },
      }),
      Layer.unwrap,
    )
