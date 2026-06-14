import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Data, Effect, String } from "effect"

import { AlchemicalEnv } from "./AlchemicalEnv.ts"

export class NotInPrError extends Data.TaggedError("NotInPrError")<{}> {}

export const PrComment =
  (resourceId: string) =>
  <Args extends Array<any>>(template: TemplateStringsArray, ...args: Args) =>
    Effect.gen(function* () {
      const {
        owner,
        repository,
        pr: issueNumber,
      } = yield* AlchemicalEnv.pipe(
        Effect.filterOrFail(
          (v) => v._tag === "Staging",
          () => new NotInPrError(),
        ),
      )
      return yield* GitHub.Comment(resourceId, {
        owner,
        repository,
        issueNumber,
        body: Output.interpolate(template, ...args).pipe(Output.map(String.stripMargin)),
      })
    })

export const PrPreviewComment = Effect.fn(function* <R = never>({
  name,
  url,
}: {
  readonly name: string
  readonly url: string | undefined | Output.Output<string | undefined, R>
}) {
  const env = yield* AlchemicalEnv
  if (env._tag === "Staging") {
    yield* PrComment("PreviewComment")`
    | ### ${name} Preview
    |
    | commit: ${env.sha}
    |
    | url: ${url}
    `.pipe(
      Effect.catchTags({
        NotInPrError: Effect.die,
      }),
    )
  }
})
