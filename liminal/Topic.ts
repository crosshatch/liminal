import type { Schema as S, Stream } from "effect"

import type * as Definition from "./Definition.ts"

export interface TopicDefinition {
  readonly key?: typeof S.Json | S.Void | undefined
  readonly value: S.Top
}

export type TopicDefinitions = Record<string, TopicDefinition>

export interface TopicProtocol {
  readonly key: typeof S.Json | S.Void
  readonly value: S.Top
}

export declare namespace TopicProtocol {
  export type FromDefinition<D extends TopicDefinition> = {
    readonly key: Definition.WithDefault<D, "key", S.Void>
    readonly value: D["value"]
  }
}

export type Topic<P extends TopicProtocol, R> = (key: P["key"]["Type"]) => Stream.Stream<P["value"]["Type"], never, R>

export type TopicProtocols = Record<string, TopicProtocol>

export declare namespace TopicProtocols {
  export type FromDefinitions<D extends TopicDefinitions> = {
    readonly [K in keyof D]: TopicProtocol.FromDefinition<D[K]>
  }
}

export type Topics<P extends TopicProtocols, R> = {
  readonly [K in keyof P]: Topic<P[K], R>
}
