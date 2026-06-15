import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Data, Effect, String } from "effect"

import { GithubEnv } from "./GithubEnv.ts"

export class NotInPrError extends Data.TaggedError("NotInPrError")<{}> {}

export const PrComment =
  (resourceId: string) =>
  <Args extends Array<any>>(template: TemplateStringsArray, ...args: Args) =>
    Effect.gen(function* () {
      const env = yield* GithubEnv
      if (env) {
        const { owner, repository, pr } = env
        if (!pr) {
          return yield* new NotInPrError()
        }
        return yield* GitHub.Comment(resourceId, {
          owner,
          repository,
          issueNumber: pr,
          body: Output.interpolate(template, ...args).pipe(Output.map(String.stripMargin)),
        })
      }
      return
    })

export const PrPreviewComment = Effect.fn(function* <R = never>({
  name,
  url,
}: {
  readonly name: string
  readonly url: string | undefined | Output.Output<string | undefined, R>
}) {
  const env = yield* GithubEnv
  if (env) {
    const { sha } = env
    yield* PrComment("PreviewComment")`
    | ### ${name} Preview
    |
    | commit: ${sha}
    |
    | url: ${url}
    `
  }
})
