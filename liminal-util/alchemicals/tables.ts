import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Drizzle from "alchemy/Drizzle"
import * as Planetscale from "alchemy/Planetscale"
import { Effect, Redacted, Config, Schema as S } from "effect"

export const tables = Effect.fn(function* ({
  database,
  devConnectionUrl,
}: {
  database: string
  devConnectionUrl: string
}) {
  const stage = yield* Alchemy.Stage
  const { out: migrationsDir } = yield* Drizzle.Schema("Schema", {
    schema: "../tables/T.ts",
    out: "../tables/migrations",
  })
  const { origin } = yield* Planetscale.PostgresRole("Admin", {
    database,
    inheritedRoles: ["postgres"],
    branch: Planetscale.PostgresBranch("Branch", {
      name: stage === "prod" ? "main" : stage,
      database,
      migrationsDir,
      ...(stage === "prod" ? {} : { parentBranch: "main" }),
    }),
  })
  const { hostname, port, pathname, username, password } = new URL(devConnectionUrl)
  const dev: Cloudflare.HyperdriveDevOrigin = {
    scheme: "postgres",
    host: hostname,
    port: yield* S.decodeEffect(S.NumberFromString.pipe(S.decodeTo(Config.Port)))(port),
    database: pathname.slice(1),
    user: decodeURIComponent(username),
    password: Redacted.make(decodeURIComponent(password)),
  }
  return yield* Cloudflare.Hyperdrive("Hyperdrive", { dev, origin })
})
