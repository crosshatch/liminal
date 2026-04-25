import { Effect, Layer } from "effect"
import { ActorRegistry } from "liminal/actor"

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

export class TicTacToeRegistry extends ActorRegistry.Service<TicTacToeRegistry>()("TicTacToeRegistry", {
  actor: TicTacToeActor,
  handlers: { Move: handleMove },
  onConnect,
  prelude: KvLive,
  runLayer: Layer.empty,
}) {}
