import { TicTacToeClient, Player } from "@liminal-examples/tictactoe/TicTacToeClient"
import { Effect, Stream, Option, Match } from "effect"
import { Accumulator } from "liminal"

type Item = Stream.Success<typeof TicTacToeClient.events>

export class GameState extends Accumulator.Service<
  GameState,
  {
    readonly name: typeof Player.Type
  }
>()("examples/GameState") {}

const reducer = GameState.reducer<Item>()

const AwaitingPartner = reducer("AwaitingPartner", () => (state) => Effect.succeed(state))

const GameStarted = reducer(
  "GameStarted",
  ({ player }) =>
    () =>
      Effect.succeed({ name: player }),
)

const GameEnded = reducer("GameEnded", () => (state) => Effect.succeed(state))

const MoveMade = reducer("MoveMade", () => (state) => Effect.succeed(state))

export const layer = GameState.layer({
  source: TicTacToeClient.events,
  initial: Effect.fn(function* (item) {
    yield* Effect.log(item)
    if (item._tag === "GameStarted") {
      return Option.some({ name: item.player })
    }
    return Option.none()
  }),
  reduce: Match.valueTags({ AwaitingPartner, GameStarted, MoveMade, GameEnded }),
  onInitial: () => Effect.void,
})
