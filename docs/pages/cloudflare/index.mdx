# Quickstart: Cloudflare

Let's cover the simplest complete path through `liminal` and `liminal-cloudflare`.

We'll implement a trimmed-down Tic-Tac-Toe example:

- Define a typed client (the public protocol).
- Define an actor with per-client attachments.
- Implement one handler and one `onConnect` hook.
- Register the actor within a Cloudflare Durable Object namespace.
- Upgrade the client from an Effect HTTP layer router route.
- Consume the client from a browser with `Client.layerSocket(...)`.

For larger apps, split methods, events, handlers, and lifecycle files into separate modules. The next
guides cover that structure in more detail.

## Define the client

Start with the protocol the browser and actor will share.

```ts
import { Socket } from "@effect/platform"
import { Effect, Layer, Schema as S, Stream } from "effect"
import { Client } from "liminal"

export const Player = S.Literal("X", "O")

export const Position = S.Struct({
  row: S.Literal(0, 1, 2),
  col: S.Literal(0, 1, 2),
})

export class TicTacToeClient extends Client.Service<TicTacToeClient>()("TicTacToeClient", {
  methods: {
    MakeMove: {
      payload: {
        position: Position,
      },
      success: S.Void,
      failure: S.Never,
    },
  },
  events: {
    GameStarted: {
      first: Player,
    },
    MoveMade: {
      player: Player,
      position: Position,
    },
    GameEnded: {
      winner: S.NullOr(Player),
    },
  },
}) {}
```

## Define the actor

The actor ties a durable name to that client protocol and defines the per-client attachment state.

```ts
import { Schema as S } from "effect"
import { Actor } from "liminal"
import { Player, TicTacToeClient } from "./TicTacToeClient.ts"

export const GameId = S.String.pipe(S.brand("Game"))

export class TicTacToeActor extends Actor.Service<TicTacToeActor>()("TicTacToeActor", {
  name: GameId,
  client: TicTacToeClient,
  attachments: {
    player: Player,
  },
}) {}
```

The important split is:

- `name` is the unique identifier for the actor within an actor namespace.
- `attachments` are per-connected-client state.

For Tic-Tac-Toe, one actor can represent one game, while attachments can distinguish player `X` from player `O`.

## Send initial state from `onConnect`

In practice, `onConnect` is the lifecycle hook where you may want to send an initial snapshot event that lets a client
hydrate itself.

```ts
import { Effect } from "effect"
import { GameStore } from "./GameStore.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"

export const onConnect = Effect.gen(function* () {
  const store = yield* GameStore

  const { name: gameId, currentClient } = yield* TicTacToeActor

  const game = yield* store.load(gameId)

  if (game.started) {
    yield* currentClient.send("GameStarted", { first: game.first })
  }
})
```

That pattern keeps the event stream as the single source of truth for the UI: connect, receive the latest snapshot
event, then keep consuming delta events, with which you reduce your local snapshot.

## Implement method handlers

Handlers run inside actor context.

```ts
import { Effect } from "effect"
import { GameStore } from "./GameStore.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"

export const handleMakeMove = TicTacToeActor.handler(
  "MakeMove",
  Effect.fn(function* ({ position }) {
    const store = yield* GameStore
    const { name: gameId, currentClient } = yield* TicTacToeActor
    const { player } = yield* currentClient.attachments

    const { ended, winner } = yield* store.saveMove({ gameId, player, position })

    yield* TicTacToeActor.sendAll("MoveMade", { player, position })

    if (ended) {
      yield* TicTacToeActor.sendAll("GameEnded", { winner })
      yield* TicTacToeActor.evict
    }
  }),
)
```

The main server-side APIs are:

- `yield* TicTacToeActor` for actor context like `name`, `clients`, and `currentClient`
- `yield* client.attachments` to read per-socket state
- `yield* client.send(...)` for one-client events
- `yield* TicTacToeActor.sendAll(...)` for broadcasts
- `yield* client.disconnect` or `yield* TicTacToeActor.evict` for disconnects

## Register the actor with `ActorRegistry`

`ActorRegistry` is the Cloudflare Durable Object wrapper around your actor.

```ts
import { Layer } from "effect"
import { ActorRegistry } from "liminal-cloudflare"
import { GameStoreLive } from "./GameStore.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"
import { handleMakeMove } from "./handlers.ts"
import { onConnect } from "./onConnect.ts"

export class TicTacToeRegistry extends ActorRegistry.Service<TicTacToeRegistry>()("TicTacToeRegistry", {
  binding: "TIC_TAC_TOE",
  actor: TicTacToeActor,
  preludeLayer: GameStoreLive,
  runLayer: Layer.empty,
  onConnect,
  handlers: {
    MakeMove: handleMakeMove,
  },
}) {}
```

The shape maps cleanly onto runtime concerns:

- `binding` is the Durable Object binding name from Wrangler.
- `preludeLayer` is long-lived infrastructure.
- `runLayer` is short-lived, request-local context.
- `handlers` is the method implementation table.

## Upgrade from an Effect HTTP route

Your HTTP route picks the actor name and initial attachments, then calls `upgrade(...)`.

```ts
import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { Api } from "./Api.ts"
import { TicTacToeRegistry } from "./TicTacToeRegistry.ts"

export const TicTacToeApiLive = HttpApiBuilder.group(Api, "ticTacToe", (_) =>
  Effect.succeed(
    _.handleRaw(
      "connect",
      Effect.fn(function* () {
        const gameId = "game-42"
        const player = "X"
        return yield* TicTacToeRegistry.upgrade(gameId, { player })
      }),
    ),
  ),
)
```

Every request that upgrades with the same actor name lands in the same Durable Object instance.

## Expose the Worker entrypoint

Cloudflare needs a default `fetch` export and a named export for the Durable Object class.

```ts
import { HttpLayerRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { Effect, Layer } from "effect"
import { Entry } from "liminal-cloudflare"

import { GameStoreLive } from "./GameStore.ts"
import { TicTacToeApiLive } from "./TicTacToeApiLive.ts"
import { TicTacToeRegistry } from "./TicTacToeRegistry.ts"

export { TicTacToeRegistry }

export default TicTacToeApiLive.pipe(
  Layer.provide([HttpServer.layerContext, TicTacToeRegistry.layer]),
  HttpLayerRouter.toHttpEffect,
  Effect.flatMap((handler) => handler),
  Effect.catchAll(() => HttpServerResponse.empty({ status: 500 })),
  Entry.make(GameStoreLive),
)
```

## Connect from the client

`Client.layerSocket(...)` turns the protocol into a live service over WebSocket.

```ts
import { Socket } from "@effect/platform"
import { Effect, Layer, Stream } from "effect"
import { Client } from "liminal"

import { TicTacToeClient } from "./TicTacToeClient.ts"

const TicTacToeClientLive = Client.layerSocket({
  client: TicTacToeClient,
  url: "/tic-tac-toe/connect",
})

Effect.gen(function* () {
  yield* TicTacToeClient.events.pipe(
    Stream.runForEach(
      Effect.fn(function* (event) {
        switch (event._tag) {
          case "GameStarted": {
            break
          }
          case "MoveMade": {
            break
          }
          case "GameEnded": {
            break
          }
        }
      }),
    ),
    Effect.forkScoped,
  )

  yield* TicTacToeClient.f("MakeMove")({
    position: {
      row: 2,
      col: 1,
    },
  })
}).pipe(Effect.provide(TicTacToeClientLive.pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal))))
```

## Keep durable state durable

Liminal preserves actor identity and connected sockets across hibernation-friendly Durable Object lifecycles, but it
does not make your whole domain model durable.

Keep the real game state in storage such as D1, Postgres, or Durable Object storage. Use attachments only for per-client
session state.
