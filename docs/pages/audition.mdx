# Audition

`Audition` combines multiple clients into one call surface and one event stream.

For larger apps, this avoids forcing the UI to swap service references manually when flows shift between contexts (for
example, from a lobby into a chat room).

## Merge multiple clients with `Audition`

```ts
import { Audition } from "liminal"

import { ChatClient } from "./chat/ChatClient.ts"
import { LobbyClient } from "./lobby/LobbyClient.ts"

export const audition = Audition.empty.pipe(Audition.add(LobbyClient), Audition.add(ChatClient))
```

After that, callers can use one method surface:

```ts
yield * audition.f("JoinRoom")({ roomId })
yield * audition.f("SendMessage")({ content: "Hello!" })
```

And one event stream:

```ts
const source = audition.events
```

## Method resolution order

`Audition.add(...)` is ordered.

With:

```ts
Audition.empty.pipe(Audition.add(LobbyClient), Audition.add(ChatClient))
```

runtime lookup tries `LobbyClient` first, then falls back to `ChatClient`.

If multiple clients expose the same method name, keep the method definitions identical. The type-level merge assumes
matching shapes for overlapping method keys.

## When to use `Audition`

Use `Audition` when one caller should not care which underlying client owns a method or event.

A common use case is flows that begin in one context (like a lobby) and later shift into another context (like a chat
room) without forcing the UI to swap service references manually.
