import { env } from "cloudflare:workers"
import { Data, Context, Layer, Effect, Schema as S, Cause, SchemaIssue, Option } from "effect"

const TypeId = "~liminal/cloudflare/Binding" as const

export class BindingError extends Data.TaggedError("BindingError")<{
  readonly cause: S.SchemaError | Cause.NoSuchElementError
}> {}

export interface Binding<Self, Id extends string, A, ROut, E, RIn> extends Context.Service<Self, A> {
  new (_: never): Context.ServiceClass.Shape<Id, A>

  readonly [TypeId]: typeof TypeId

  readonly layer: (config: { binding: string }) => Layer.Layer<Self | ROut, BindingError | E, RIn>
}

export const Binding =
  <Self>() =>
  <Id extends string, A extends object, ROut = never, E = never, RIn = never>(
    id: Id,
    f: (value: object) => value is A,
    makeLayer: (resource: A) => Layer.Layer<ROut, E, RIn> = () => Layer.empty as never,
  ): Binding<Self, Id, A, ROut, E, RIn> => {
    const tag = Context.Service<Self, A>()(id)
    const layer = ({ binding }: { binding: string }) =>
      Effect.fromNullishOr((env as never)[binding]).pipe(
        Effect.filterOrFail(f, (v) => new S.SchemaError(new SchemaIssue.InvalidValue(Option.some(v)))),
        Effect.catch((cause) => new BindingError({ cause }).asEffect()),
        Effect.map((v) => Layer.mergeAll(makeLayer(v), Layer.succeed(tag, v))),
        Layer.unwrap,
      )
    return Object.assign(tag, { [TypeId]: TypeId, layer })
  }
