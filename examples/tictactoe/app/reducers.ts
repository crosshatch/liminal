import { TicTacToeClient } from "@liminal-examples/tictactoe/TicTacToeClient"
import { Effect } from "effect"

export const GameStarted = TicTacToeClient.reducer(
  "GameStarted",
  () =>
    ({ name }) =>
      Effect.succeed({ name, awaitingPartner: false }),
)

export const GameEnded = TicTacToeClient.reducer("GameEnded", () => (state) => Effect.succeed(state))

export const MoveMade = TicTacToeClient.reducer("MoveMade", () => (state) => Effect.succeed(state))
