import { Context, Schema as S } from "effect"

import * as Binding from "./Binding.ts"

export class Ai extends Context.Service<Ai, globalThis.Ai>()("liminal/cloudflare/Ai") {}

export const layer = Binding.layer(Ai, S.Struct({ run: S.Unknown }))
