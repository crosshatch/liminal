import { Effect } from "effect"

import { setBoard, getBoard } from "./Games.ts"
import { mapInternalError } from "./mapInternalError.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"
import { OutOfTurnError, SlotTakenError } from "./TicTacToeClient.ts"

// oxfmt-ignore
const LINES = [
  // rows
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  // columns
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  // diagonals
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
] as const;

export const handleMove = TicTacToeActor.handler(
  "Move",
  Effect.fn(function* ({ position }) {
    const { currentClient, name: gameId } = yield* TicTacToeActor
    const { board, turn } = yield* getBoard(gameId)
    const { player } = yield* currentClient.attachments
    if (turn !== player) {
      return yield* new OutOfTurnError()
    }
    if (board[position[0]][position[1]] !== undefined) {
      return yield* new SlotTakenError()
    }
    yield* TicTacToeActor.sendAll("MoveMade", { player, position })
    if (LINES.some((line) => line.every(([r, c]) => board[r][c] === player))) {
      yield* TicTacToeActor.sendAll("GameEnded", {
        winner: player,
      })
    } else if (board.every((row) => row.every((player) => player !== undefined))) {
      yield* TicTacToeActor.sendAll("GameEnded", {})
    } else {
      board[position[0]][position[1]] = player
      yield* setBoard({
        board,
        turn: turn === "X" ? "O" : "X",
      })
    }
  }, mapInternalError),
)
