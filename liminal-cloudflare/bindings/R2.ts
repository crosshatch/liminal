import { Context } from "effect"

import * as Binding from "./Binding.ts"

export class R2 extends Context.Service<R2, R2Bucket>()("liminal/cloudflare/R2") {}

export const layer = Binding.layer(R2, ["put", "get"])
