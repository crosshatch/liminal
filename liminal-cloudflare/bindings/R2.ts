import { Binding } from "./Binding.ts"

export class R2 extends Binding<R2>()("liminal/cloudflare/R2", (v): v is R2Bucket => "put" in v && "get" in v) {}
