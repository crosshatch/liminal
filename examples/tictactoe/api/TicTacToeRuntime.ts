import { Effect, Layer } from "effect"
import { ActorRuntime } from "liminal"

import Move from "./handleMove.ts"
import hydrate from "./hydrate.ts"
import { layer as layerKv } from "./Kv.ts"
import { TicTacToeNamespace } from "./TicTacToeNamespace.ts"

export class TicTacToeRuntime extends ActorRuntime.make({
  namespace: TicTacToeNamespace,
  prelude: layerKv,
  hydrate,
  onDisconnect: Effect.void,
  external: { Move },
  layer: Layer.empty,
  hibernation: "5 seconds",
  internal: {},
}) {}
