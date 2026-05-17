import { Schema as S } from "effect"
import { Actor } from "liminal"

import { Player } from "./domain.ts"
import { TicTacToeClient } from "./TicTacToeClient.ts"

export class TicTacToeActor extends Actor.Service<TicTacToeActor>()("examples/TicTacToeActor", {
  client: TicTacToeClient,
  name: S.String,
  attachments: { player: Player },
}) {}
