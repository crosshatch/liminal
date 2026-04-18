import * as Binding from "./Binding.ts"

const TypeId = "~liminal/cloudflare/Ai" as const

export interface AiDefinition<Binding_ extends string> {
  readonly binding: Binding_
}

export interface Ai<Self, Id extends string, Binding_ extends string> extends Binding.Binding<
  Self,
  Id,
  Binding_,
  globalThis.Ai,
  never,
  never,
  never
> {
  readonly [TypeId]: typeof TypeId

  readonly definition: AiDefinition<Binding_>
}

export const Service =
  <Self>() =>
  <Id extends string, Binding_ extends string>(id: Id, definition: AiDefinition<Binding_>): Ai<Self, Id, Binding_> => {
    const tag = Binding.Service<Self>()(id, definition.binding, (v): v is globalThis.Ai => "run" in v)

    return Object.assign(tag, { [TypeId]: TypeId, definition })
  }
