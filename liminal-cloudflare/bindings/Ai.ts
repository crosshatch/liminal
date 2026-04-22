import { Binding } from "./Binding.ts"

export class Ai extends Binding<Ai>()("liminal/cloudflare/Ai", (v): v is globalThis.Ai => "run" in v) {}
