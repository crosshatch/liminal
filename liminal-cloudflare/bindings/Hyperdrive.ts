import { Effect, Redacted } from "effect"

import { Binding } from "./Binding.ts"

export class Hyperdrive extends Binding<Hyperdrive>()(
  "liminal/cloudflare/Hyperdrive",
  (v): v is globalThis.Hyperdrive => "connectionString" in v,
) {
  static readonly connectionString: Effect.Effect<Redacted.Redacted<string>, never, Hyperdrive> = this.asEffect().pipe(
    Effect.map(({ connectionString }) => Redacted.make(connectionString)),
  )
}
