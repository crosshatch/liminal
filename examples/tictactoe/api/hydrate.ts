import { TicTacToeActor } from "./TicTacToeActor.ts"
import { Effect } from "effect"

export default Effect.gen(function* () {
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
