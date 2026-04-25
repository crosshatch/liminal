import { Context } from "effect"

export class DoState extends Context.Service<DoState, globalThis.DurableObjectState<{}>>()("liminal/DoState") {}
