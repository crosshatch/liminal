import { Schema as S } from "effect"
import { Client } from "liminal"

export const Player = S.Literals(["X", "O"])
export const Coordinate = S.Literals([0, 1, 2])
export const Coordinates = S.Tuple([Coordinate, Coordinate])

export class OutOfTurnError extends S.TaggedErrorClass<OutOfTurnError>()("OutOfTurnError", {}) {}
export class SlotTakenError extends S.TaggedErrorClass<SlotTakenError>()("SlotTakenError", {}) {}

export class TicTacToeClient extends Client.Service<TicTacToeClient>()("examples/TicTacToeClient", {
  events: {
    GameEnded: {
      winner: S.optional(Player),
    },
    GameStarted: {
      player: Player,
    },
    MoveMade: {
      player: Player,
      position: Coordinates,
    },
  },
  methods: {
    Move: {
      payload: {
        position: Coordinates,
      },
      failure: S.Never,
      success: S.Void,
    },
  },
}) {}
