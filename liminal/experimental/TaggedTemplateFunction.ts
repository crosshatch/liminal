import { Effect } from "effect"

export type TemplateStringsArrayLike = {
  raw: ReadonlyArray<string> | ArrayLike<string>
}

type ExtractE<T> = [Extract<T, Effect.Effect<any, any, any>>] extends [never]
  ? never
  : Effect.Error<Extract<T, Effect.Effect<any, any, any>>>

type ExtractR<T> = [Extract<T, Effect.Effect<any, any, any>>] extends [never]
  ? never
  : Effect.Services<Extract<T, Effect.Effect<any, any, any>>>

export const raw = Effect.fnUntraced(function* <Substitutions extends Array<unknown>>(
  template: TemplateStringsArrayLike,
  ...substitutions: Substitutions
): Effect.fn.Return<string, ExtractE<Substitutions[number]>, ExtractR<Substitutions[number]>> {
  return String.raw(
    template,
    ...(yield* Effect.all(substitutions.map((v) => (Effect.isEffect(v) ? v : Effect.succeed(v)))) as Effect.Effect<
      Array<string>,
      ExtractE<Substitutions[number]>,
      ExtractR<Substitutions[number]>
    >),
  )
})

export type TaggableHead = TemplateStringsArrayLike | string | Effect.Effect<string, any, any>

export type TaggableRest<H extends TaggableHead> = H extends TemplateStringsArrayLike ? Array<unknown> : []

export const normalize = Effect.fnUntraced(function* <H extends TaggableHead, ARest extends TaggableRest<H>>(
  a0: H,
  ...aRest: ARest
): Effect.fn.Return<string, ExtractE<H | ARest[number]>, ExtractR<H | ARest[number]>> {
  if (Effect.isEffect(a0)) {
    return yield* a0
  }
  if (typeof a0 === "string") {
    return a0
  }
  return yield* raw(a0, ...aRest)
})
