import { WorkerdActorNamespace } from "liminal/workerd"

import { TicTacToeActor } from "./TicTacToeActor.ts"

export class TicTacToeNamespace extends WorkerdActorNamespace.Service<TicTacToeNamespace>()("TicTacToeNamespace", {
  binding: "TICTACTOE",
  actor: TicTacToeActor,
  methods: {},
}) {}
