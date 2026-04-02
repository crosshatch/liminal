# Liminal

Effect-first actors on Cloudflare.

> Note: Liminal is unstable. Use at your peril.

## Example: Tik Tak Toe

### Define The Client

Start with the client. This is the shared protocol between the client and the actor.

```ts
import { Schema as S, Effect, Stream } from "effect"
import { Client } from "liminal"
import { Socket } from "@effect/platform"

export const Player = S.Literal("X", "O")

export const Position = S.Struct({
  row: S.Literal(0, 1, 2),
  col: S.Literal(0, 1, 2),
})

// Define the client.
export class TicTacToeClient extends Client.Service<TicTacToeClient>()("TicTacToeClient", {
  // One method.
  methods: {
    MakeMove: {
      payload: {
        position: Position,
      },
      success: S.Void,
      failure: S.Never,
    },
  },

  // Three events.
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

// Later...

// Within an effect...
Effect.gen(function* () {
  // Stream events from the client.
  yield* TicTacToeClient.events.pipe(
    Stream.runForEach(
      Effect.fn(function* (event) {
        switch (event._tag) {
          case "GameStarted": {
            // ...
            break
          }
          case "MoveMade": {
            const { player, position } = event
            // ...
            break
          }
          case "GameEnded": {
            const { winner } = event
            // ...
            break
          }
        }
      }),
    ),
    Effect.forkScoped,
  )

  // And call methods.
  yield* TicTacToeClient.f("MakeMove")({
    position: {
      col: 1,
      row: 2,
    },
  })

  // ...
}).pipe(
  // Provide the client layer.
  Effect.provide(
    Client.layerSocket({
      client: TicTacToeClient,
      url: "/tic-tac-toe",
    }).pipe(
      // And the constructor with which to create sockets.
      Layer.provide(Socket.layerWebSocketConstructorGlobal),
    ),
  ),
)
```

`Client.Service` gives you two main things:

- `TicTacToeClient.f("MakeMove")` for calls
- `TicTacToeClient.events` for the event stream

One important note about this particular example: `MakeMove.failure` is `S.Never`, which means the method has no typed
failure channel. That is fine for a minimal example, but a real game usually wants a typed invalid-move error.

### Define The Actor

Next define the actor that speaks that client.

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
    lastSeenMove: S.Int,
  },
}) {}
```

This actor definition is small, but it carries most of the shape of the system:

- `name` is the durable identity of the actor. Here that is the `GameId`.
- `client` is the protocol this actor accepts (the client we already created).
- `attachments` are per-client values stored on each connected socket. Hibernation/wake-up serialization/deserialization
  are managed by Liminal.

For Tic-Tac-Toe, the actor name is the game, while attachments describe the connected player. That means two different
clients can connect to the same `gameId` while carrying different attachment state:

- player `X` with `{ player: "X", lastSeenMove: 0 }`
- player `O` with `{ player: "O", lastSeenMove: 0 }`

That split is exactly why this model works well with hibernation:

- the actor identity survives because the Durable Object is addressed by name
- each socket's attachment state survives because Liminal serializes it onto the WebSocket

### Keep Game State In Durable Storage

The actor should not rely on in-memory board state. Keep the actual game state somewhere durable, such as a sqlite
database.

The storage details are not the point of this guide, so we will use a small service interface and leave the
implementation up to your app.

```ts
import { Context, Effect, Layer } from "effect"

export class GameStore extends Context.Tag("GameStore")<
  GameStore,
  {
    readonly loadOrCreate: (gameId: string) => Effect.Effect<{
      readonly started: boolean
    }>

    readonly notePlayerJoined: (gameId: string, player: "X" | "O") => Effect.Effect<ReadonlyArray<"X" | "O">>

    readonly markStarted: (gameId: string, first: "X" | "O") => Effect.Effect<void>

    readonly saveMove: (args: {
      readonly gameId: string
      readonly player: "X" | "O"
      readonly position: {
        readonly row: 0 | 1 | 2
        readonly col: 0 | 1 | 2
      }
    }) => Effect.Effect<{
      readonly ended: boolean
      readonly winner: "X" | "O" | null
      readonly moveCount: number
    }>
  }
>() {}

// Whatever layer provides `GameStore` in your app.
declare const GameStoreLive: Layer.Layer<GameStore>

export const PreludeLive = GameStoreLive
```

`PreludeLive` is where the durable infrastructure for the actor lives. In a real app this might include:

- D1
- Postgres
- Durable object storage utilities
- Logging
- Config

### Run Setup In `onConnect`

`onConnect` runs when a new client (socket) successfully upgrades into the actor.

This is the right place to:

- Inspect the current client
- Inspect that client's attachment state
- Load durable state
- Emit initial events
- Do any one-time setup for this new connection

For Tic-Tac-Toe, we can mark the player as joined and start the game once both players are present.

```ts
import { Effect } from "effect"

import { GameStore } from "./GameStore.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"

export const onConnect = Effect.gen(function* () {
  const store = yield* GameStore
  const { name: gameId, currentClient } = yield* TicTacToeActor
  const { player } = yield* currentClient.attachments

  const game = yield* store.loadOrCreate(gameId)
  const joined = yield* store.notePlayerJoined(gameId, player)

  if (!game.started && joined.includes("X") && joined.includes("O")) {
    yield* store.markStarted(gameId, "X")

    yield* TicTacToeActor.sendAll("GameStarted", {
      first: "X",
    })
  }
})
```

There are a few important Liminal APIs in that snippet:

- `yield* TicTacToeActor` gives you actor-level context such as the current client (the one being connected in this
  case), actor name and connected clients
- `yield* currentClient.attachments` reads the current client's attachment state
- `TicTacToeActor.sendAll(...)` broadcasts an event to every connected client for that actor

If you only want to emit to the current client, use the current handle directly:

```ts
const { currentClient } = yield * TicTacToeActor

yield *
  currentClient.send("GameStarted", {
    first: "X",
  })
```

### Implement Method Handlers

Handlers are where the actor actually responds to method calls.

For `MakeMove`, we want to:

1. Read the current player from socket attachments.
2. Read the actor name so we know which game to mutate.
3. Persist the move in durable storage.
4. Update the caller's attachment state.
5. Emit a `MoveMade` event.
6. Maybe emit `GameEnded`.
7. Optionally disconnect everyone once the game is over.

```ts
import { Effect } from "effect"

import { GameStore } from "../GameStore.ts"
import { TicTacToeActor } from "../TicTacToeActor.ts"

export const handleMakeMove = TicTacToeActor.handler(
  "MakeMove",
  Effect.fn(function* ({ position }) {
    const store = yield* GameStore
    const { currentClient, name: gameId } = yield* TicTacToeActor
    const { player } = yield* currentClient.attachments

    const { ended, winner, moveCount } = yield* store.saveMove({
      gameId,
      player,
      position,
    })

    // Attachment state is per-client and survives hibernation.
    yield* currentClient.save({
      player,
      lastSeenMove: moveCount,
    })

    yield* TicTacToeActor.sendAll("MoveMade", {
      player,
      position,
    })

    if (ended) {
      yield* TicTacToeActor.sendAll("GameEnded", {
        winner,
      })

      // Optional: close both sockets and evict the actor when the game is over.
      yield* TicTacToeActor.evict
    }
  }),
)
```

This one handler demonstrates most of the server-side API surface:

- `yield* TicTacToeActor` reads the actor name and client
- `yield* sender.attachments` reads client-specific attachment state
- `yield* sender.save(...)` updates client-specific attachment state
- `yield* TicTacToeActor.sendAll(...)` emits events to both players
- `yield* TicTacToeActor.evict` disconnects every connected client for the game

If you want to disconnect only one client instead of the whole actor, use the client handle directly:

```ts
Effect.gen(function* () {
  // ...

  const { currentClient, clients } = yield* TicTacToeActor

  yield* currentClient.disconnect
})
```

The actor also exposes `clients`:

```ts
Effect.gen(function* () {
  // ...

  const { clients } = yield* TicTacToeActor

  for (const client of clients) {
    const { player, lastSeenMove } = yield* client.attachments

    // ...

    yield* client.disconnect
  }
})
```

That is all you need if the client only exposes one method.

### Optional: Derive Request-Local Context

`ActorRegistry` has both a `preludeLayer` and a `runLayer`.

- `preludeLayer` is the actor runtime's long-lived infrastructure
- `runLayer` is rebuilt for each incoming message

If you want a request-local dependency derived from the current client, `runLayer` is the right place.

For Tic-Tac-Toe, a small `CurrentPlayer` service is a good example.

```ts
import { Context, Effect, Layer } from "effect"

import { TicTacToeActor } from "./TicTacToeActor.ts"

export class CurrentPlayer extends Context.Tag("CurrentPlayer")<CurrentPlayer, "X" | "O">() {
  static readonly layer = Effect.gen(function* () {
    const { currentClient } = yield* TicTacToeActor
    const { player } = yield* currentClient.attachments
    return player
  }).pipe(Layer.effect(this))
}
```

You do not have to use a request layer. If you do not need one, `Layer.empty` is fine.

### Tie It Together With `ActorRegistry`

`ActorRegistry` is the Cloudflare Durable Object wrapper around your actor.

```ts
import { ActorRegistry } from "liminal-cloudflare"

import { CurrentPlayer } from "./CurrentPlayer.ts"
import { PreludeLive } from "./GameStore.ts"
import { TicTacToeActor } from "./TicTacToeActor.ts"
import { handleMakeMove } from "./handleMakeMove.ts"
import { onConnect } from "./onConnect.ts"

export class TicTacToeRegistry extends ActorRegistry.Service<TicTacToeRegistry>()("TicTacToeRegistry", {
  binding: "TIC_TAC_TOE",
  actor: TicTacToeActor,
  preludeLayer: PreludeLive,
  runLayer: CurrentPlayer.layer,
  onConnect,
  handlers: { handleMakeMove },
}) {}
```

What each field means:

- `binding`: the Cloudflare Durable Object binding name
- `actor`: the actor definition
- `preludeLayer`: durable infrastructure and shared services
- `runLayer`: per-run derived dependencies
- `handlers`: the method implementation table
- `onConnect`: setup logic for each new socket
- `hibernation`: the hibernation timeout for hibernatable WebSocket events

`hibernation` is the knob that makes the hibernation story explicit. Liminal already restores actor name and socket
attachments for hibernated sockets, but your app still needs to persist actual game state somewhere durable.

### Upgrade From An Effect HTTP Route

We route HTTP requests to Liminal actors by "upgrading" within an Effect HTTP layer router.

That is what `TicTacToeRegistry.upgrade(...)` does.

For Tic-Tac-Toe, the route decides:

- which game we are connecting to
- whether the client is `X` or `O`
- what the initial attachment state should be

```ts
import { HttpApiBuilder } from "@effect/platform"
import { Effect, Schema as S } from "effect"

import { Api } from "./Api.ts"
import { Player } from "./TicTacToeClient.ts"
import { TicTacToeRegistry } from "./TicTacToeRegistry.ts"

export const TicTacToeApiLive = HttpApiBuilder.group(Api, "ticTacToe", (_) =>
  Effect.succeed(
    _.handleRaw(
      "connect",
      Effect.fn(function* () {
        const { gameId, player } = yield* selectAvailableGame

        return yield* TicTacToeRegistry.upgrade(gameId, {
          player,
          lastSeenMove: 0,
        })
      }),
    ),
  ),
)
```

That is the whole handoff.

You choose the actor name and initial attachments, and `upgrade(...)` does the rest:

- Looks up the Durable Object by actor name.
- Validates that the connecting client matches the expected Liminal client (otherwise fails with an `AuditionError`).
- Serializes the attachments onto the socket.
- Returns the `101` response.

This is the moment where "one actor = one game" becomes real: every request with the same `gameId` upgrades into the
same actor.

### Create The Cloudflare Entrypoint

Your Worker entrypoint needs two things:

1. A default `fetch` export built with `Entry.make(...)`.
2. Named exports for the Durable Object classes that Wrangler binds.

```ts
import { HttpLayerRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { Effect, Layer } from "effect"
import { Entry } from "liminal-cloudflare"

import { PreludeLive } from "./GameStore.ts"
import { TicTacToeApiLive } from "./TicTacToeApiLive.ts"
import { TicTacToeRegistry } from "./TicTacToeRegistry.ts"

export { TicTacToeRegistry }

export default TicTacToeApiLive.pipe(
  Layer.provide([HttpServer.layerContext, TicTacToeRegistry.layer]),
  HttpLayerRouter.toHttpEffect,
  Effect.flatMap((handler) => handler),
  Effect.catchAll(() => HttpServerResponse.empty({ status: 500 })),
  Entry.make(PreludeLive),
)
```

`Entry.make(...)` is the Cloudflare wrapper that turns your Effect HTTP program into the Worker `fetch` handler.

The named export matters because Wrangler's Durable Object binding points at the class name.

### Register The Durable Object In Wrangler

The registry binding and the exported class name must line up.

```jsonc
{
  "main": "./api/liminal.ts",
  "durable_objects": {
    "bindings": [
      {
        "name": "TIC_TAC_TOE",
        "class_name": "TicTacToeRegistry",
      },
    ],
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["TicTacToeRegistry"],
    },
  ],
}
```

The important alignment is:

- `binding: "TIC_TAC_TOE"` in `ActorRegistry`
- `name: "TIC_TAC_TOE"` in Wrangler
- `export { TicTacToeRegistry }` in the Worker entrypoint
- `class_name: "TicTacToeRegistry"` in Wrangler

### Consume The Client With `Client.layerSocket`

On the client side, `Client.layerSocket(...)` gives you the live `TicTacToeClient` service over WebSocket.

```ts
import { Effect, Stream } from "effect"
import { Client } from "liminal"

import { TicTacToeClient } from "./TicTacToeClient.ts"

export const TicTacToeClientLive = (args: { readonly gameId: string; readonly player: "X" | "O" }) =>
  Client.layerSocket({
    client: TicTacToeClient,
    url: "/tic-tac-toe/connect",
    replay: {
      mode: "startup",
    },
  })

Effect.gen(function* () {
  yield* TicTacToeClient.events.pipe(
    Stream.runForEach(
      Effect.fn(function* (event) {
        switch (event._tag) {
          case "GameStarted": {
            // ...
            break
          }
          case "MoveMade": {
            const { player, position } = event
            // ...
            break
          }
          case "GameEnded": {
            const { winner } = event
            // ...
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
}).pipe(
  Effect.provide(
    TicTacToeClientLive({
      gameId: "game-42",
      player: "X",
    }).pipe(Socket.layerWebSocketConstructorGlobal),
  ),
)
```

### Replay Options

`Client.layerSocket(...)` also accepts a replay configuration:

```ts
Client.layerSocket({
  client: TicTacToeClient,
  url: "/tic-tac-toe/connect?gameId=game-42&player=X",
  replay: {
    mode: "startup",
    limit: 16,
  },
})
```

The options are:

- no `replay`: subscribers only see live events from the moment they subscribe
- `mode: "startup"`: the first subscriber gets the buffered events, then that startup buffer closes
- `mode: "all-subscribers"`: every subscriber gets the buffered events before live events
- `limit`: caps the replay buffer size

Only actor events are replayed. Method successes and failures are not replayed.

For a game UI, `mode: "startup"` is often the right default when you want a newly mounted screen to immediately catch up
on the most recent events without replaying the whole game to every later subscriber.

### Hibernation Semantics

Liminal is optimized for hibernation, but hibernation-safe design still depends on how you model your app.

What Liminal handles for you:

- The actor name is persisted and restored.
- Connected sockets are restored after hibernation.
- Each socket's attachments are serialized and restored.
- `sender.save(...)` updates that serialized attachment state.

What your app must still do:

- Persist the actual board state somewhere durable.
- Persist turn order somewhere durable.
- Persist whether the game has ended somewhere durable.

Important consequences:

- `onConnect` runs for newly upgraded sockets, not for every hibernation wake-up.
- If the actor wakes up after hibernation, your storage layer is still the source of truth.
- `sender.save(...)` is for per-client session state, not whole-actor game state.
- `TicTacToeActor.evict` disconnects clients, but it does not delete your durable game record.

There is one more small detail worth knowing: disconnects are flushed after the current handler completes. In practice
that means `sender.disconnect` and `TicTacToeActor.evict` mark sockets for closure during the handler, and the actual
close happens immediately after the message finishes processing. This ensures no race conditions emerge when disconnects
are triggered within a method call that must return a result over socket; the result is returned, and then the
connection is closed.

### Suggested File Layout

One reasonable layout for this example is:

```txt
api/tic-tac-toe/
  TicTacToeClient.ts
  TicTacToeActor.ts
  GameStore.ts
  CurrentPlayer.ts
  TicTacToeRegistry.ts
  TicTacToeApiLive.ts
  lifecycle/
    onConnect.ts
  handlers/
    handleMakeMove.ts
    handlers.ts
  main.ts
```
