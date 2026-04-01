import { Context } from "effect"

export class NativeRequest extends Context.Tag("liminal/cloudflare/NativeRequest")<NativeRequest, Request>() {}
