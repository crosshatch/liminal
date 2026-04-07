import { env } from "cloudflare:workers"

export const unsafeEnv: Record<keyof any, unknown> = env as never
