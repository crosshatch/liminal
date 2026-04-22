import { D1Client } from "@effect/sql-d1"

import { Binding } from "./Binding.ts"

export class D1 extends Binding<D1>()(
  "liminal/cloudflare/D1",
  (v): v is D1Database => "exec" in v,
  (db) => D1Client.layer({ db }),
) {}
