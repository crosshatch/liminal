import { Effect, Layer } from "effect"
import { WorkerdActorNamespace } from "liminal/workerd"

import { handleMove } from "./handleMove.ts"
import { KvLive } from "./KvLive.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"

const onConnect = Effect.gen(function* () {
  const { clients, currentClient } = yield* TicTacToeActor
  if (clients.size === 1) {
    yield* currentClient.send("AwaitingPartner", {})
  } else {
    yield* TicTacToeActor.others.send("GameStarted", {
      player: "X",
    })
    yield* currentClient.send("GameStarted", {
      player: "O",
    })
  }
}).pipe(Effect.orDie)

export class TicTacToeNamespace extends WorkerdActorNamespace.Service<TicTacToeNamespace>()("TicTacToeNamespace", {
  actor: TicTacToeActor,
  prelude: KvLive,
  onConnect,
  handlers: { Move: handleMove },
  layer: Layer.empty,
}) {}
