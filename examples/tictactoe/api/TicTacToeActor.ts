import { Schema as S } from "effect"
import { Actor } from "liminal"

import { TicTacToeClient } from "./TicTacToeClient.ts"
import { Player } from "./domain.ts"

export class TicTacToeActor extends Actor.Service<TicTacToeActor>()("examples/TicTacToeActor", {
  client: TicTacToeClient,
  name: S.String,
  attachments: { player: Player },
}) {}
