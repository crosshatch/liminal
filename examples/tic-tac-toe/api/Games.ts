import { Effect, Types } from "effect"

import type { Player } from "./TicTacToeClient.ts"

import { Database } from "./Database.ts"

export type Board = Types.TupleOf<3, Types.TupleOf<3, typeof Player.Type | undefined>>

export const init: Effect.Effect<
  {
    readonly gameId: string
    readonly player: typeof Player.Type
  },
  never,
  Database
> = null!

export const getBoard: (gameId: string) => Effect.Effect<
  {
    readonly turn: typeof Player.Type
    readonly board: Board
  },
  never,
  Database
> = null!

export const setBoard: (config: { readonly turn: typeof Player.Type; readonly board: Board }) => Effect.Effect<void> =
  null!
