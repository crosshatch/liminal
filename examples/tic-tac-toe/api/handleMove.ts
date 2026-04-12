import { Effect } from "effect";
import { TicTacToeActor } from "./TicTacToeActor.ts";
import { GameState } from "./GameState.ts";
import { OutOfTurnError, SlotTakenError } from "./TicTacToeClient.ts";

const LINES = [
  // rows
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  // cols
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  // diags
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
] as const;

export const handleMove = TicTacToeActor.handler(
  "Move",
  Effect.fn(function* ({ position }) {
    const state = yield* GameState;
    const { board, turn } = state;
    const { currentClient } = yield* TicTacToeActor;
    const { player } = yield* currentClient.attachments;
    if (turn !== player) {
      return yield* new OutOfTurnError();
    }
    if (board[position[0]][position[1]] !== undefined) {
      return yield* new SlotTakenError();
    }
    yield* TicTacToeActor.sendAll("MoveMade", { player, position });
    if (LINES.some((line) => line.every(([r, c]) => board[r][c] === player))) {
      yield* TicTacToeActor.sendAll("GameEnded", {
        winner: player,
      });
    } else if (board.every((row) => row.every((player) => player !== undefined))) {
      yield* TicTacToeActor.sendAll("GameEnded", {});
    } else {
      board[position[0]][position[1]] = player;
      state.turn = turn === "X" ? "O" : "X";
    }
  }, Effect.orDie),
);
