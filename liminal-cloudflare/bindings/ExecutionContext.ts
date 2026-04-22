import { Context } from "effect"

export class ExecutionContext extends Context.Service<ExecutionContext, globalThis.ExecutionContext>()(
  "liminal/cloudflare/ExecutionContext",
) {}
