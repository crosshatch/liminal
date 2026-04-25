import { BrowserSocket } from "@effect/platform-browser"
import { TicTacToeClient } from "@liminal-examples/tictactoe/TicTacToeClient"
import { Layer } from "effect"
import { Atom } from "effect/unstable/reactivity"
import { Client } from "liminal"

import * as State from "./State"

export const runtime = Atom.runtime(
  State.layer.pipe(
    Layer.provideMerge(
      Client.layerSocket({
        client: TicTacToeClient,
        url: "/play",
        replay: { mode: "startup" },
      }).pipe(Layer.provide(BrowserSocket.layerWebSocketConstructor)),
    ),
  ),
)
