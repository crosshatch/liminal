import { Effect, Layer } from "effect"
import { ActorRegistry } from "liminal-cloudflare"

import { handleMove } from "./handleMove.ts"
import { KvLive } from "./KvLive.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"

const onConnect = Effect.gen(function* () {
  const { clients, currentClient } = yield* TicTacToeActor
  if (clients.size === 1) {
    yield* currentClient.send("GameInitialized", {})
  } else {
    for (const client of clients) {
      yield* TicTacToeActor.all.send("GameStarted", {
        player: client === currentClient ? "O" : "X",
      })
    }
  }
}).pipe(Effect.orDie)

export class TicTacToeRegistry extends ActorRegistry.Service<TicTacToeRegistry>()("TicTacToeRegistry", {
  actor: TicTacToeActor,
  handlers: { Move: handleMove },
  onConnect,
  prelude: KvLive,
  runLayer: Layer.empty,
}) {}
