import { BrowserSocket } from "@effect/platform-browser"
import { TicTacToeClient } from "@liminal-examples/tictactoe/TicTacToeClient"
import { Layer } from "effect"
import { Atom } from "effect/unstable/reactivity"
import { Client } from "liminal"
import * as reducers from "./reducers"

export const runtime = Atom.runtime(
  Client.layerSocket({
    client: TicTacToeClient,
    url: "/play",
    replay: { mode: "startup" },
    reducers,
  }).pipe(Layer.provide(BrowserSocket.layerWebSocketConstructor)),
)
