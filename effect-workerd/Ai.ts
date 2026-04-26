import { Context } from "effect"

import * as Binding from "./Binding.ts"

export class Ai extends Context.Service<Ai, globalThis.Ai>()("effect-workerd/Ai") {}

export const layer = Binding.layer(Ai, ["run"])
