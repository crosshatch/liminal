import { Effect, Layer } from "effect"
import { ActorRuntime } from "liminal"

import Move from "./handleMove.ts"
import hydrate from "./hydrate.ts"
import { KvLive } from "./KvLive.ts"
import { TicTacToeNamespace } from "./TicTacToeNamespace.ts"

export class TicTacToeRuntime extends ActorRuntime.make({
  namespace: TicTacToeNamespace,
  prelude: KvLive,
  hydrate,
  onDisconnect: Effect.void,
  external: { Move },
  layer: Layer.empty,
  hibernation: "5 seconds",
  internal: {},
}) {}
