import { Context } from "effect"

export class Env extends Context.Service<Env, Record<string, unknown>>()("effect-workerd/Env") {}
