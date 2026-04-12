// import { Socket } from "@effect/platform";
// import { Effect, Layer, Stream } from "effect";
// import { Client } from "liminal";
// import { TicTacToeClient } from "./api/TicTacToeClient.js";
//
// Effect.gen(function* () {
//   yield* TicTacToeClient.events.pipe(
//     Stream.runForEach(
//       Effect.fn(function* (item) {
//         yield* TicTacToeClient.f("Move")({
//           position: [0, 0],
//         });
//         yield* Effect.log(item);
//       }),
//     ),
//     Effect.forkScoped,
//   );
// }).pipe(
//   Effect.provide(
//     Client.layerSocket({
//       client: TicTacToeClient,
//       url: "/",
//     }).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)),
//   ),
//   Effect.scoped,
//   Effect.runFork,
// );
