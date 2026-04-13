import { Effect, Stream, Option, flow, Match } from "effect"
import { Accumulator } from "liminal"

import { TicTacToeClient, Player } from "../api/TicTacToeClient.ts"

type Item = Stream.Stream.Success<typeof TicTacToeClient.events>

interface State {
  readonly name: typeof Player.Type
}

export class GameState extends Accumulator.Service<GameState, State>()("examples/GameState") {}
const reducer = GameState.reducer<Item>()

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
  reduce: flow(
    Match.value,
    Match.tagsExhaustive({
      GameStarted,
      MoveMade,
      GameEnded,
    }),
  ),
})
