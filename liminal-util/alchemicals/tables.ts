import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Drizzle from "alchemy/Drizzle"
import * as Planetscale from "alchemy/Planetscale"
import { Effect, Redacted } from "effect"

const devOrigin = (connectionString: string): Cloudflare.HyperdriveDevOrigin => {
  const url = new URL(connectionString)
  return {
    scheme: url.protocol.slice(0, -1) as Cloudflare.HyperdriveScheme,
    host: url.hostname,
    port: Number(url.port || Cloudflare.defaultPort(url.protocol.slice(0, -1) as Cloudflare.HyperdriveScheme)),
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: Redacted.make(decodeURIComponent(url.password)),
  }
}

export const tables = Effect.fn(function* ({ database, dev }: { database: string; dev: string }) {
  const stage = yield* Alchemy.Stage
  const branch = stage === "prod" ? "main" : stage
  const { out: migrationsDir } = yield* Drizzle.Schema("Schema", {
    schema: "../tables/T.ts",
    out: "../migrations",
  })
  const { origin } = yield* Planetscale.PostgresRole("Admin", {
    database,
    inheritedRoles: ["postgres"],
    branch: Planetscale.PostgresBranch("Branch", {
      name: branch,
      database,
      parentBranch: "main",
      migrationsDir,
    }),
  })
  return yield* Cloudflare.Hyperdrive("Hyperdrive", { dev: devOrigin(dev), origin })
})
