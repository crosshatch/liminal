import { env } from "cloudflare:workers"
import { Data, Context, Layer, Effect } from "effect"

export const TypeId = "~liminal/cloudflare/Binding" as const

export type BindingError = BindingNotFoundError | BindingValidationError

export class BindingNotFoundError extends Data.TaggedError("BindingNotFoundError")<{}> {}

export class BindingValidationError extends Data.TaggedError("BindingValidationError")<{}> {}

export interface Binding<Self, Id extends string, Binding_ extends string, A, ROut, E, RIn> extends Context.Service<
  Self,
  A
> {
  new (_: never): Context.ServiceClass.Shape<Id, A>

  readonly [TypeId]: typeof TypeId

  readonly binding: Binding_

  readonly layer: Layer.Layer<Self | ROut, BindingError | E, RIn>
}

export const Service =
  <Self>() =>
  <Id extends string, Binding_ extends string, A extends object, ROut = never, E = never, RIn = never>(
    id: Id,
    binding: Binding_,
    f: (value: object) => value is A,
    makeLayer: (resource: A) => Layer.Layer<ROut, E, RIn> = () => Layer.empty as never,
  ): Binding<Self, Id, Binding_, A, ROut, E, RIn> => {
    const tag = Context.Service<Self, A>()(id)
    const layer = Effect.fromNullishOr((env as never)[binding]).pipe(
      Effect.catchTag("NoSuchElementError", () => new BindingNotFoundError().asEffect()),
      Effect.filterOrFail(f, () => new BindingValidationError()),
      Effect.map((v) => Layer.mergeAll(makeLayer(v), Layer.succeed(tag, v))),
      Layer.unwrap,
    )
    return Object.assign(tag, { [TypeId]: TypeId, binding, layer })
  }
