import { Data, Context, Layer, Effect } from "effect"

import { unsafeEnv } from "./unsafeEnv.ts"

export const TypeId = "~liminal/cloudflare/Binding" as const

export type BindingError = BindingNotFoundError | BindingValidationError

export class BindingNotFoundError extends Data.TaggedError("BindingNotFoundError")<{}> {}

export class BindingValidationError extends Data.TaggedError("BindingValidationError")<{}> {}

export interface Binding<Self, Id extends string, Binding_ extends string, A> extends Context.Tag<Self, A> {
  new (_: never): Context.TagClassShape<Id, A>

  readonly [TypeId]: typeof TypeId

  readonly binding: Binding_

  readonly layer: Layer.Layer<Self, BindingError>
}

export const Service =
  <Self>() =>
  <Id extends string, Binding_ extends string, A extends object>(
    id: Id,
    binding: Binding_,
    f: (value: object) => value is A,
  ): Binding<Self, Id, Binding_, A> => {
    const tag = Context.Tag(id)<Self, A>()
    const layer = Effect.fromNullable(unsafeEnv[binding]).pipe(
      Effect.catchTag("NoSuchElementException", () => new BindingNotFoundError()),
      Effect.filterOrFail(f, () => new BindingValidationError()),
      Layer.effect(tag),
    )
    return Object.assign(tag, { [TypeId]: TypeId, binding, layer })
  }
