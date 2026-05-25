import { ActorNamespace } from "liminal"

import { TicTacToeActor } from "./TicTacToeActor.ts"

export class TicTacToeNamespace extends ActorNamespace.Service<TicTacToeNamespace>()("TicTacToeNamespace", {
  binding: "TICTACTOE",
  actor: TicTacToeActor,
  internal: {},
}) {}
