import type { ProtocolDefinition } from "./Protocol.ts"
import { Schema as S, Types, Effect } from "effect"

export type Reducer<D extends ProtocolDefinition, K extends keyof D["events"] = keyof D["events"]> = (
  event: Types.ExtractTag<ReturnType<typeof S.TaggedUnion<D["events"]>>["Type"], Extract<K, string>>,
) => (state: D["state"]["Type"]) => Effect.Effect<D["state"]["Type"], never, unknown>

export type Reducers<D extends ProtocolDefinition> = {
  readonly [K in keyof D["events"]]: Reducer<D, K>
}

export declare namespace Reducers {
  export type Services<Self, D extends Record<string, Reducer<any, any>>> = Exclude<
    {
      readonly [K in keyof D]: D[K] extends (...args: any) => (...args: any) => Effect.Effect<any, any, infer R>
        ? R
        : never
    }[keyof D],
    Self
  >
}
