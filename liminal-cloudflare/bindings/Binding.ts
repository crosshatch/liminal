import { env } from "cloudflare:workers"
import { Data, Context, Layer, Effect } from "effect"

const TypeId = "~liminal/cloudflare/Binding" as const

export class BindingMissingError extends Data.TaggedError("BindingMissingError")<{
  readonly missing: string
}> {}

export class BindingInvalidError extends Data.TaggedError("BindingInvalidError")<{
  readonly invalid: string
}> {}

export interface Binding<Self, Id extends string, A, ROut, E, RIn> extends Context.Service<Self, A> {
  new (_: never): Context.ServiceClass.Shape<Id, A>

  readonly [TypeId]: typeof TypeId

  readonly layer: (config: {
    binding: string
  }) => Layer.Layer<Self | ROut, BindingMissingError | BindingInvalidError | E, RIn>
}

export const Binding =
  <Self>() =>
  <Id extends string, A extends object, ROut = never, E = never, RIn = never>(
    id: Id,
    is: (value: object) => value is A,
    makeLayer: (resource: A) => Layer.Layer<ROut, E, RIn> = () => Layer.empty as never,
  ): Binding<Self, Id, A, ROut, E, RIn> => {
    const tag = Context.Service<Self, A>()(id)
    const layer = ({ binding }: { binding: string }) =>
      Effect.gen(function* () {
        const v = (env as never)[binding]
        if (!v) {
          return yield* new BindingMissingError({ missing: binding })
        }
        if (!is(v)) {
          return yield* new BindingInvalidError({ invalid: binding })
        }
        return Layer.mergeAll(Layer.succeed(tag, v), makeLayer(v))
      }).pipe(Layer.unwrap)
    return Object.assign(tag, { [TypeId]: TypeId, layer })
  }
