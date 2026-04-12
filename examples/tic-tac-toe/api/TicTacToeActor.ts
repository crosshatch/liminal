import { TicTacToeClient, Player } from "./TicTacToeClient.ts";
import { Actor } from "liminal";
import { Schema as S } from "effect";

export class TicTacToeActor extends Actor.Service<TicTacToeActor>()("examples/TicTacToeActor", {
  client: TicTacToeClient,
  name: S.String,
  attachments: {
    player: Player,
  },
}) {}
