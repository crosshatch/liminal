import { SqlClient } from "@effect/sql"
import { D1Client } from "@effect/sql-d1"
import { ConfigError } from "effect"

import * as Binding from "./Binding.ts"

const TypeId = "~liminal/cloudflare/D1" as const

export interface D1Definition<Binding_ extends string> {
  readonly binding: Binding_
}

export interface D1<Self, Id extends string, Binding_ extends string> extends Binding.Binding<
  Self,
  Id,
  Binding_,
  globalThis.D1Database,
  D1Client.D1Client | SqlClient.SqlClient,
  ConfigError.ConfigError,
  never
> {
  readonly [TypeId]: typeof TypeId

  readonly definition: D1Definition<Binding_>
}

export const Service =
  <Self>() =>
  <Id extends string, Binding_ extends string>(id: Id, definition: D1Definition<Binding_>): D1<Self, Id, Binding_> => {
    const tag = Binding.Service<Self>()(
      id,
      definition.binding,
      (v): v is globalThis.D1Database => "exec" in v,
      (db) => D1Client.layer({ db }),
    )

    return Object.assign(tag, { [TypeId]: TypeId, definition })
  }
