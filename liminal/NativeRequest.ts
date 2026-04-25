import { Context } from "effect"

export class NativeRequest extends Context.Service<NativeRequest, Request>()("liminal/NativeRequest") {}
