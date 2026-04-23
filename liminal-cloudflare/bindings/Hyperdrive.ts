import { Effect, Redacted, Schema as S, Context } from "effect"

import * as Binding from "./Binding.ts"

export class Hyperdrive extends Context.Service<Hyperdrive, globalThis.Hyperdrive>()(
  "liminal-cloudflare/bindings/Hyperdrive",
) {}

export const layer = Binding.layer(
  Hyperdrive,
  S.Struct({
    connectionString: S.String,
  }),
)

export const connectionString = Hyperdrive.asEffect().pipe(
  Effect.map(({ connectionString }) => Redacted.make(connectionString)),
)
