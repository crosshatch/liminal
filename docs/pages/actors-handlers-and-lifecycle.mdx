# Actors, Handlers, and Lifecycle

Actors are the server-side runtime for a client definition.

Actor files stay intentionally small. Most of the real behavior lives in:

- handler modules
- `onConnect` lifecycle modules
- `runLayer`-derived request context

## Define an actor

An actor ties together three things:

- A durable name.
- A client definition.
- Attachment state stored per connected client.

```ts
import { Schema as S } from "effect"
import { Actor } from "liminal"
import { ChatClient } from "./ChatClient.ts"

const RoomId = S.String.pipe(S.brand("RoomId"))
const UserId = S.String.pipe(S.brand("UserId"))

export class ChatActor extends Actor.Service<ChatActor>()("Chat", {
  client: ChatClient,
  name: RoomId,
  attachments: {
    userId: UserId,
  },
}) {}
```

## Name versus attachments

Keep the split clear:

- `name` is an actor instance's unique identifier.
- `attachments` are per-client state.

In a chat room actor, the name could be the room id, while attachments would be used to identify which user is behind
each connected socket.

This is one of the most useful modeling decisions; we allow multiple clients connect to the same actor while keeping
client-specific contexts isolated from one another.

## Read actor context in handlers

`yield* ActorTag` gives you the actor runtime context.

```ts
Effect.gen(function* () {
  // ...

  const { name, clients, currentClient } = yield* ChatActor

  const { userId } = yield* currentClient.attachments
})
```

## Use `onConnect` to send snapshot events

```ts
import { Effect } from "effect"
import { ChatActor } from "../ChatActor.ts"
import { Db } from "../../context/Db.ts"

export const onConnect = Effect.gen(function* () {
  const { name: roomId, currentClient } = yield* ChatActor

  const db = yield* Db

  const snapshot = yield* loadRoomSnapshot(db, { roomId })

  yield* currentClient.send("RoomSnapshot", snapshot)
})
```

`onConnect` can be used to keep the client-side state story simple:

- Connect.
- Receive a full snapshot event.
- Receive delta events after that.
- Reduce the deltas into the local state.

This pattern becomes especially useful when paired with `Accumulator`.

## Implement actor-local handlers with `Actor.handler(...)`

The simplest handler pattern is actor-bound.

```ts
import { Effect } from "effect"

import { ChatActor } from "../ChatActor.ts"
import { Db } from "../../context/Db.ts"

export default ChatActor.handler(
  "SendMessage",
  Effect.fn(function* ({ content }) {
    const { name: roomId, currentClient } = yield* ChatActor

    const { userId } = yield* currentClient.attachments

    const db = yield* Db

    const { timestamp, messageId } = yield* insertMessage(db, { roomId, userId, content })

    yield* ChatActor.sendAll("MessageReceived", { userId, content, timestamp })

    return { messageId, timestamp }
  }),
)
```

## Broadcast, target, disconnect

Client handles support the core per-socket operations:

- `yield* sender.attachments`
- `yield* sender.send(...)`
- `yield* sender.save(...)`
- `yield* sender.disconnect`

Actors add the whole-actor operations:

- `yield* ChatActor.sendAll(...)`
- `yield* ChatActor.evict`

Broadcast example:

```ts
Effect.gen(function* () {
  // ...

  yield* ChatActor.sendAll("UserJoined", { userId, displayName })
})
```

Selective disconnect example (kicking specific users):

```ts
Effect.gen(function* () {
  // ...

  const { clients } = yield* ChatActor

  for (const client of clients) {
    const { userId } = yield* client.attachments
    if (bannedUserIds.has(userId)) {
      yield* client.disconnect
    }
  }
})
```

Whole-actor eviction example (closing a room):

```ts
Effect.gen(function* () {
  // ...

  yield* ChatActor.evict
})
```

## Attachment state is for the caller, not the actor

`client.save(...)` updates serialized attachment state for one connected client.

That is useful for values like:

- The caller's user id.
- The caller's role in a game.
- Per-socket cursors or last-seen sequence numbers.

Do not use attachments as whole-actor storage. Persist shared state elsewhere.

## Use `runLayer` for request-local services

Many handlers want convenient access to values derived from actor context.

Use `runLayer` to derive services like `CurrentUserId` or `Authorization` from the actor name and current client
attachments.
