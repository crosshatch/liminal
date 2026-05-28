import { Effect } from "effect"

import { TicTacToeActor } from "./TicTacToeActor.ts"
import type { TicTacToeClient } from "./TicTacToeClient.ts"

export default Effect.gen(function* () {
  const { clients } = yield* TicTacToeActor
  if (clients.size === 1) {
    return {
      awaitingPartner: true,
      name: "X" as const,
    } satisfies TicTacToeClient["State"]
  } else {
    yield* Effect.addFinalizer(() => TicTacToeActor.others.send("GameStarted", {}))
    return {
      awaitingPartner: false,
      name: "O" as const,
    } satisfies TicTacToeClient["State"]
  }
}).pipe(Effect.orDie)
