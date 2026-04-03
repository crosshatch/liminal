# Accumulator

An `Accumulator` is a typed state container driven by events. It reduces incoming events into long-lived client state,
giving UI code stable field-level streams instead of forcing every component to understand the full event log.

If you are building anything larger than a toy screen, this is the most important guide after the quickstart.

## Define an accumulator

A simple example:

```ts
import { Option, Schema as S } from "effect"
import { Accumulator } from "liminal"

import { LobbyClient } from "./LobbyClient.ts"

const RoomId = S.String.pipe(S.brand("RoomId"))

export class LobbyAccumulator extends Accumulator.Service<LobbyAccumulator>()("LobbyAccumulator", {
  fields: {
    currentRoomId: S.Option(RoomId),
  },
  events: LobbyClient.definition.events,
}) {}
```

An accumulator has two type surfaces:

- `fields`: the local reduced state
- `events`: the incoming event union it knows how to process

## Write reducers one event at a time

Reducers attach behavior to one event tag.

```ts
const RoomJoined = LobbyAccumulator.reducer("RoomJoined", ({ roomId }) => {
  return LobbyAccumulator.update({
    currentRoomId: Option.some(roomId),
  })
})

const SessionEnded = LobbyAccumulator.reducer("SessionEnded", () =>
  LobbyAccumulator.update({
    currentRoomId: Option.none(),
  }),
)
```

For small state updates, you usually want one of two helpers:

- `Accumulator.update(...)` to replace whole state
- `Accumulator.updateField(...)` to update one field

Larger accumulators use `updateField(...)` heavily for array edits like add, rename, and remove.

## Build the accumulator layer

Once you have the source event stream and reducers, install the live layer.

```ts
export const layer = LobbyAccumulator.layer({
  source: LobbyClient.events,
  reducers: { RoomJoined, SessionEnded },
  initial: {
    currentRoomId: Option.none(),
  },
})
```

That layer starts the reduction loop and exposes:

- `LobbyAccumulator.current`
- `LobbyAccumulator.state`
- `LobbyAccumulator.signal("field")`

## Consume reduced state with `signal(...)`

UI code usually consumes accumulator fields rather than raw events.

```ts
export const currentRoomIdAtom = atomRuntime.atom(LobbyAccumulator.signal("currentRoomId"))
```

The same pattern works for any field:

- `ChatAccumulator.signal("messages")`
- `ChatAccumulator.signal("members")`
- `ChatAccumulator.signal("roomInfo")`

That pattern gives the UI stable field-level streams instead of forcing every component to understand the full event
log.

## Snapshot-on-connect plus delta events

The accumulator design depends on a deliberate event pattern:

1. `onConnect` sends a snapshot event such as `RoomSnapshot` or `SessionStarted`
2. later handlers emit delta events such as `MessageReceived` or `UserLeft`
3. reducers apply the snapshot first, then keep folding deltas

That is why `onConnect` is so important. Without a snapshot event, a reconnecting UI would need a separate imperative
fetch path.

## Real multi-client pattern

Larger apps combine `Audition` and `Accumulator` together.

An app-wide accumulator listens to both lobby and chat events:

```ts
const UserId = S.String.pipe(S.brand("UserId"))
const RoomId = S.String.pipe(S.brand("RoomId"))

export class AppAccumulator extends Accumulator.Service<AppAccumulator>()("AppAccumulator", {
  events: {
    ...LobbyClient.definition.events,
    ...ChatClient.definition.events,
  },
  fields: {
    roomId: RoomId.pipe(S.optional),
    userId: UserId.pipe(S.optional),
    members: S.Array(
      S.Struct({
        userId: UserId,
        displayName: S.String,
      }),
    ),
  },
}) {}
```

And its live layer waits for the first snapshot event before installing the initial state:

```ts
const source = audition.events.pipe(Stream.forever)
const { _tag, ...initial } = yield * Deferred.await(deferred)

return AppAccumulator.layer({
  source,
  reducers,
  initial,
})
```

The important part is that the first snapshot event becomes the accumulator's initial value.

## When to use `Accumulator`

Use `Accumulator` when:

- multiple screens care about the same evolving state
- reconnects should replay state from events
- `onConnect` already emits a snapshot event
- you want field-level streams like `signal("members")`

Skip it when a screen only needs one or two direct method calls and no long-lived local state.
