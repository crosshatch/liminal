import * as Binding from "./Binding.ts"

const TypeId = "~liminal/cloudflare/R2" as const

export interface D1Definition<Binding_ extends string> {
  readonly binding: Binding_
}

export interface R2<Self, Id extends string, Binding_ extends string> extends Binding.Binding<
  Self,
  Id,
  Binding_,
  globalThis.R2Bucket,
  never,
  never,
  never
> {
  readonly [TypeId]: typeof TypeId

  readonly definition: D1Definition<Binding_>
}

export const Service =
  <Self>() =>
  <Id extends string, Binding_ extends string>(id: Id, definition: D1Definition<Binding_>): R2<Self, Id, Binding_> => {
    const tag = Binding.Service<Self>()(id, definition.binding, (v): v is R2Bucket => "put" in v && "get" in v)

    return Object.assign(tag, { [TypeId]: TypeId, definition })
  }
