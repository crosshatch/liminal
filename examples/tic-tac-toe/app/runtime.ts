import { BrowserSocket } from "@effect/platform-browser";
import { TicTacToeClient } from "../api/TicTacToeClient.ts";
import { Atom } from "@effect-atom/atom-react";
import { Client } from "liminal";
import { Layer } from "effect";
import * as State from "./State";

export const runtime = Atom.runtime(
  State.layer.pipe(
    Layer.provideMerge(
      Client.layerSocket({
        client: TicTacToeClient,
        url: "/play",
        replay: {
          mode: "startup",
        },
      }).pipe(Layer.provide(BrowserSocket.layerWebSocketConstructor)),
    ),
  ),
);
