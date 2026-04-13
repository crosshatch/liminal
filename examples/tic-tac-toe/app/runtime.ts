import { Atom } from "@effect-atom/atom-react"
import { BrowserSocket } from "@effect/platform-browser"
import { Layer } from "effect"
import { Client } from "liminal"

import { TicTacToeClient } from "../api/TicTacToeClient.ts"
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
