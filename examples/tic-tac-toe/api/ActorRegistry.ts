/** @effect-diagnostics unnecessaryEffectGen:skip-file */
import { Effect, Layer } from "effect";
import { handleMove } from "./handleMove";
import { TicTacToeActor } from "./TicTacToeActor";
import { ActorRegistry } from "liminal-cloudflare";
import * as GameState from "./GameState.ts";

export class TicTacToeRegistry extends ActorRegistry.Service<TicTacToeRegistry>()("examples/TicTacToeRegistry", {
  actor: TicTacToeActor,
  binding: "TicTacToe",
  handlers: {
    Move: handleMove,
  },
  onConnect: Effect.gen(function* () {
    const { clients } = yield* TicTacToeActor;
    yield* TicTacToeActor.sendAll("GameStarted", {
      player: clients.size === 1 ? "X" : "O",
    });
  }).pipe(Effect.orDie),
  preludeLayer: GameState.layer,
  runLayer: Layer.empty,
}) {}
