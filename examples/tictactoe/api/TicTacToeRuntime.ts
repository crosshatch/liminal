import { Effect, Layer } from "effect"
import { WorkerdActorRuntime } from "liminal/workerd"

import { handleMove } from "./handleMove.ts"
import { KvLive } from "./KvLive.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"
import { TicTacToeNamespace } from "./TicTacToeNamespace.ts"

const hydrate = Effect.gen(function* () {
  const { clients } = yield* TicTacToeActor
  if (clients.size === 1) {
    return {
      awaitingPartner: true,
      name: "X" as const,
    }
  } else {
    yield* TicTacToeActor.others.send("GameStarted", {})
    return {
      awaitingPartner: false,
      name: "O" as const,
    }
  }
}).pipe(Effect.orDie)

export class TicTacToeRuntime extends WorkerdActorRuntime.make({
  namespace: TicTacToeNamespace,
  prelude: KvLive,
  hydrate,
  onDisconnect: Effect.void,
  external: { Move: handleMove },
  layer: Layer.empty,
  hibernation: "5 seconds",
}) {}
