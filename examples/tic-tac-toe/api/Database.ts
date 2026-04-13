import { D1 } from "liminal-cloudflare"

export class Database extends D1.Service<Database>()("Database", {
  binding: "TIC_TAC_TOE_D1",
}) {}
