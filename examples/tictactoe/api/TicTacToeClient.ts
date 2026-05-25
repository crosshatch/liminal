import { Schema as S } from "effect"
import { Client } from "liminal"

import { Coordinates, Player } from "./domain.ts"
import * as external from "./external.ts"

export class TicTacToeClient extends Client.Service<TicTacToeClient>()("examples/TicTacToeClient", {
  events: {
    GameStarted: {},
    MoveMade: {
      player: Player,
      position: Coordinates,
    },
    GameEnded: {
      winner: S.optional(Player),
    },
  },
  external,
  state: {
    awaitingPartner: S.Boolean,
    name: Player,
  },
}) {}
