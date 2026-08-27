import type { Schema as S } from "effect"

import type * as Method from "./Method.ts"
import type * as Topic from "./Topic.ts"

export interface ProtocolDefinition {
  readonly state: {
    readonly actor: S.Struct.Fields
    readonly client: S.Struct.Fields
    readonly topics: Record<string, Topic.TopicDefinition>
  }
  readonly methods: Record<string, Method.MethodDefinition>
}
