import { Option, Types, Layer, pipe, String, Effect, Schema as S, Data, SchemaAST, Context } from "effect"

import * as Loader from "./Loader.ts"

export type Template<A> = (...[value]: A extends undefined ? [] : [value: A]) => string

export class TemplateMisalignedError extends Data.TaggedError("TemplateMisalignedError")<{
  readonly url: string
  readonly keys: ReadonlyArray<string>
}> {}

export class NoSuchTemplateError extends Data.TaggedError("NoSuchTemplateError")<{ url: string }> {}

export interface TemplateClass<Self, Id extends string, A> extends Context.Tag<Self, Template<A>> {
  new (_: never): Context.TagClassShape<Id, Template<A>>

  readonly layer: Layer.Layer<Self, NoSuchTemplateError | TemplateMisalignedError | Loader.LoaderError, Loader.Loader>

  readonly synthesize: (...[value]: A extends undefined ? [] : [value: A]) => Effect.Effect<string, never, Self>
}

export type Payload = Record<string, S.Schema<any, string> | S.optional<S.Schema<any, string>>>

export declare namespace Payload {
  export type FromDefinition<P extends Payload | undefined> = P extends infer Q extends Payload
    ? S.Struct<Q>["Type"]
    : {}
}

export const Service =
  <Self>() =>
  <const Id extends string, const P extends Payload | undefined>(
    id: Id,
    {
      url,
      payload,
    }: {
      readonly url: string
      readonly payload?: P
    },
  ): TemplateClass<Self, Id, Payload.FromDefinition<P>> => {
    type Make_ = Template<Payload.FromDefinition<P>>
    type Self_ = TemplateClass<Self, Id, Payload.FromDefinition<P>>
    const self = Context.Tag(`liminal/Template/${id}`)<Self, Make_>() as never as Types.Mutable<Self_>
    self.layer = Effect.gen(function* () {
      const loader = yield* Loader.Loader
      const template = yield* loader.load(url).pipe(Effect.map(Option.getOrUndefined))
      if (!template) {
        return yield* new NoSuchTemplateError({ url })
      }
      const [head, ...rest] = pipe(template, String.trim, String.split("{{"))
      if ((!payload || !Object.keys(payload).length) && rest.length === 1) {
        return () => template
      }
      const segments = rest.flatMap((part) => {
        const i = part.indexOf("}}")
        return {
          key: part.slice(0, i).trim(),
          tail: part.slice(i + 2),
        }
      })
      const keys = segments.map(({ key }) => key)
      if (payload) {
        const keys_ = new Set(keys)
        const dne = new Set<string>()
        const schema = S.Struct(payload)
        const fields = SchemaAST.getPropertySignatures(SchemaAST.encodedBoundAST(schema.ast))
        for (const field of fields) {
          if (!field.isOptional && !keys_.has(field.name.toString())) {
            dne.add(field.name.toString())
          }
        }
        if (dne.size) {
          return yield* new TemplateMisalignedError({
            url,
            keys: [...dne.values()],
          })
        }
      } else if (segments.length) {
        return yield* new TemplateMisalignedError({ url, keys })
      }
      const make: Make_ = (value?) =>
        value
          ? head + segments.map(({ key, tail }) => `${(value as Record<typeof key, string>)[key]}${tail}`).join("")
          : template
      return make
    }).pipe(Layer.effect(self))
    self.synthesize = (...args) => self.pipe(Effect.map((make) => make(...args)))
    return self as Self_
  }
