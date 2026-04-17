import { Effect, Layer } from "effect"
import { ActorRegistry } from "liminal-cloudflare"

import { Database } from "./Database.ts"
import { handleMove } from "./handleMove.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"

const onConnect = Effect.gen(function* () {
  const { clients } = yield* TicTacToeActor
  const player = clients.size === 1 ? "X" : "O"
  yield* TicTacToeActor.sendAll("GameStarted", { player }).pipe(Effect.orDie)
})

export class TicTacToeRegistry extends ActorRegistry.Service<TicTacToeRegistry>()("examples/TicTacToeRegistry", {
  actor: TicTacToeActor,
  binding: "TicTacToe",
  handlers: { Move: handleMove },
  onConnect,
  preludeLayer: Database.layer,
  runLayer: Layer.empty,
}) {}
