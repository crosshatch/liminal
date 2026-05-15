import { Effect, Layer } from "effect"
import { WorkerdActorRuntime } from "liminal/workerd"

import Move from "./handleMove.ts"
import { KvLive } from "./KvLive.ts"
import { TicTacToeNamespace } from "./TicTacToeNamespace.ts"
import hydrate from "./hydrate.ts"

export class TicTacToeRuntime extends WorkerdActorRuntime.make({
  namespace: TicTacToeNamespace,
  prelude: KvLive,
  hydrate,
  onDisconnect: Effect.void,
  external: { Move },
  layer: Layer.empty,
  hibernation: "5 seconds",
}) {}
