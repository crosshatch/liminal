import { Context, Layer, Types } from "effect";
import type { Player } from "./TicTacToeClient.ts";

export type Board = Types.TupleOf<3, Types.TupleOf<3, typeof Player.Type | undefined>>;

export class GameState extends Context.Tag("examples/Context")<
  GameState,
  {
    turn: typeof Player.Type;
    board: Board;
  }
>() {}

export const layer = Layer.succeed(GameState, {
  turn: "X",
  board: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => undefined)) as never,
});
