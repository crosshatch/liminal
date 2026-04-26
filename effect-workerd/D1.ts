import { D1Client } from "@effect/sql-d1"
import { Context } from "effect"

import * as Binding from "./Binding.ts"

export class D1 extends Context.Service<D1, D1Database>()("effect-workerd/D1") {}

export const layer = Binding.layer(D1, ["exec"], (db) => D1Client.layer({ db }))
