import { Context } from "effect"

export class DurableObjectState extends Context.Service<DurableObjectState, globalThis.DurableObjectState<{}>>()(
  "liminal/cloudflare/DurableObjectState",
) {}
