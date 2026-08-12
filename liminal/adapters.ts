import { Context } from "effect"

export class NativeDurableObjectState extends Context.Service<
  NativeDurableObjectState,
  globalThis.DurableObjectState
>()("liminal/adapters/NativeDurableObjectState") {}
