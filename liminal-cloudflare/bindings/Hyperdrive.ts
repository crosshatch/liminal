import { Effect, Redacted } from "effect"

import * as Binding from "./Binding.ts"

const TypeId = "~liminal/cloudflare/Hyperdrive" as const

export interface HyperdriveDefinition<Binding_ extends string> {
  readonly binding: Binding_
}

export interface Hyperdrive<Self, Id extends string, Binding_ extends string> extends Binding.Binding<
  Self,
  Id,
  Binding_,
  globalThis.Hyperdrive,
  never,
  never,
  never
> {
  readonly [TypeId]: typeof TypeId

  readonly definition: HyperdriveDefinition<Binding_>

  readonly connectionString: Effect.Effect<Redacted.Redacted<string>, never, Self>
}

export const Service =
  <Self>() =>
  <Id extends string, Binding_ extends string>(
    id: Id,
    definition: HyperdriveDefinition<Binding_>,
  ): Hyperdrive<Self, Id, Binding_> => {
    const tag = Binding.Service<Self>()(
      id,
      definition.binding,
      (v): v is globalThis.Hyperdrive => "connectionString" in v,
    )

    const connectionString = tag.asEffect().pipe(Effect.map(({ connectionString }) => Redacted.make(connectionString)))

    return Object.assign(tag, { [TypeId]: TypeId, definition, connectionString })
  }
