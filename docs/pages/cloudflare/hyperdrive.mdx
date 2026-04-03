# Cloudflare Hyperdrive

`Hyperdrive.Service(...)` is the `liminal-cloudflare` wrapper around a Cloudflare Hyperdrive binding.

It is intentionally small. Its main job is to expose the binding as a typed Effect service and surface the connection
string as a redacted value.

## Define a Hyperdrive service

```ts
import { Effect, Redacted } from "effect"
import { Hyperdrive } from "liminal-cloudflare"

export class AppHyperdrive extends Hyperdrive.Service<AppHyperdrive>()("Database", {
  binding: "HYPERDRIVE",
}) {}
```

The only required definition field is the Cloudflare binding name.

## What the wrapper gives you

From `Hyperdrive.ts`, the wrapper exposes:

- `.layer` from the shared binding helper
- `.binding` with the Cloudflare env binding name
- `.connectionString` as `Effect<Redacted<string>, never, Self>`

```ts
const connectionString = AppHyperdrive.connectionString
```

Internally, that is just:

```ts
tag.pipe(Effect.map(({ connectionString }) => Redacted.make(connectionString)))
```

So the wrapper is a thin typed shell over the raw Hyperdrive binding.

## Why the connection string is redacted

The raw Hyperdrive connection string is sensitive configuration.

Exposing it as `Redacted<string>` makes it harder to leak accidentally through logs or error output while still being
easy to thread into database clients.

## Common pattern: local dev fallback

Use Hyperdrive in production, but swap to a local Postgres URL in development:

```ts
import { Effect, Redacted } from "effect"

import { AppConfig } from "./AppConfig.ts"

export const connectionString = Effect.flatMap(AppConfig, ({ dev }) =>
  dev ? Effect.succeed(Redacted.make("postgres://dev:dev@localhost:5432/myapp")) : AppHyperdrive.connectionString,
)
```

This is a good default pattern if you want the same application wiring in local dev and Cloudflare deploys.

## Provide the binding with `.layer`

```ts
export const PreludeLive = Layer.mergeAll(
  Db.layer.pipe(Layer.provideMerge(Layer.mergeAll(AppHyperdrive.layer, AppConfig.layer))),
)
```

## What this wrapper does not do

`Hyperdrive.Service(...)` does not:

- Create a database client.
- Manage pooling for you.
- Run migrations.
- Abstract SQL libraries.

It only turns the Cloudflare binding into a typed Effect service and exposes the connection string safely.

## Wrangler configuration

Your Wrangler config must declare the Hyperdrive binding:

```jsonc
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<your-hyperdrive-config-id>",
    },
  ],
}
```

The `binding` field here must match the `binding` value in your `Hyperdrive.Service(...)` definition.
