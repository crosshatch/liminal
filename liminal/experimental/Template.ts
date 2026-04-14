import { Layer, Effect, Schema as S, Data, Context } from "effect"

import * as Loader from "./Loader.ts"

export type Template<A> = (...[value]: A extends undefined ? [] : [value: A]) => string

export class TemplateMisalignedError extends Data.TaggedError("TemplateMisalignedError")<{
  readonly url: string
  readonly keys: ReadonlyArray<string>
}> {}

export class NoSuchTemplateError extends Data.TaggedError("NoSuchTemplateError")<{ url: string }> {}

export interface TemplateClass<Self, Id extends string, A> extends Context.Service<Self, Template<A>> {
  new (_: never): Context.ServiceClass.Shape<Id, Template<A>>

  readonly layer: Layer.Layer<Self, NoSuchTemplateError | TemplateMisalignedError | Loader.LoaderError, Loader.Loader>

  readonly synthesize: (...[value]: A extends undefined ? [] : [value: A]) => Effect.Effect<string, never, Self>
}

export const Service =
  <Self>() =>
  <const Id extends string, const P extends S.Struct.Fields>(
    _id: Id,
    _config: {
      readonly url: string
      readonly payload: P
    },
  ): TemplateClass<Self, Id, S.Struct<P>["Type"]> => {
    throw 0
  }

// type Make_ = Template<Payload.FromDefinition<P>>
// type Self_ = TemplateClass<Self, Id, Payload.FromDefinition<P>>
// const tag = Context.Service<Self, Make_>()(id)
// const layer = Effect.gen(function* () {
//   const loader = yield* Loader.Loader
//   const template = yield* loader.load(url).pipe(Effect.map(Option.getOrUndefined))
//   if (!template) {
//     return yield* new NoSuchTemplateError({ url })
//   }
//   const [head, ...rest] = pipe(template, String.trim, String.split("{{"))
//   if ((!payload || !Object.keys(payload).length) && !rest.length) {
//     return () => template
//   }
//   const segments = rest.flatMap((part) => {
//     const i = part.indexOf("}}")
//     if (i === -1) {
//       return []
//     }
//     return {
//       key: part.slice(0, i).trim(),
//       tail: part.slice(i + 2),
//     }
//   })
//   const keys = segments.map(({ key }) => key)
//   if (payload) {
//     const keys_ = new Set(keys)
//     const dne = new Set<string>()
//     const schema = S.Struct(payload)
//     for (const field of schema.ast.propertySignatures) {
//       if (!SchemaAST.isOptional(field.type) && !keys_.has(field.name.toString())) {
//         dne.add(field.name.toString())
//       }
//     }
//     if (dne.size) {
//       return yield* new TemplateMisalignedError({
//         url,
//         keys: [...dne.values()],
//       })
//     }
//   } else if (segments.length) {
//     return yield* new TemplateMisalignedError({ url, keys })
//   }
//   const make: Make_ = (value?) =>
//     value
//       ? head + segments.map(({ key, tail }) => `${(value as Record<typeof key, string>)[key]}${tail}`).join("")
//       : template
//   return make
// }).pipe(Layer.effect(tag))

// const synthesize = (...args) => tag.pipe(Effect.map((make) => make(...args)))

// return Object.assign(tag, { synthesize })
