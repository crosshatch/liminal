import { Context } from "effect"

export class ExecutionContext extends Context.Tag("liminal/cloudflare/ExecutionContext")<
  ExecutionContext,
  globalThis.ExecutionContext
>() {}
