import { Effect, Layer } from "effect"
import { WorkerdActorNamespace } from "liminal/workerd"

import { handleMove } from "./handleMove.ts"
import { KvLive } from "./KvLive.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"

const onConnect = Effect.gen(function* () {
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

export class TicTacToeNamespace extends WorkerdActorNamespace.Service<TicTacToeNamespace>()("TicTacToeNamespace", {
  actor: TicTacToeActor,
  prelude: KvLive,
  onConnect,
  onDisconnect: Effect.void,
  handlers: { Move: handleMove },
  layer: Layer.empty,
}) {}
