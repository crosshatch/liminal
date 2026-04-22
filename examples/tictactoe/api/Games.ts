import { Effect, Types } from "effect"
import { KeyValueStore } from "effect/unstable/persistence"

import type { Player } from "./TicTacToeClient.ts"

export type Board = Types.TupleOf<3, Types.TupleOf<3, typeof Player.Type | undefined>>

export const init: Effect.Effect<
  {
    readonly gameId: string
    readonly player: typeof Player.Type
  },
  never,
  KeyValueStore.KeyValueStore
> = null!

export const getBoard: (gameId: string) => Effect.Effect<
  {
    readonly turn: typeof Player.Type
    readonly board: Board
  },
  never,
  KeyValueStore.KeyValueStore
> = null!

export const setBoard: (config: {
  readonly turn: typeof Player.Type
  readonly board: Board
}) => Effect.Effect<void, never, KeyValueStore.KeyValueStore> = null!
