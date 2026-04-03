# Browser and Worker Transports

Liminal is not limited to WebSockets.

Two transport families are available:

- `Client.layerSocket(...)` for server-backed actors over WebSocket
- `Client.layerWorker(...)` for browser-local actors over workers or `MessagePort`

`liminal-browser` adds `Singleton.make(...)`, which lets you host an actor locally inside the browser and talk to it
through the same client protocol.

## `Client.layerSocket(...)`

Use sockets when the actor lives on the server.

```ts
import { Layer } from "effect"
import { Client } from "liminal"

const ClientsLive = Layer.mergeAll(
  Client.layerSocket({
    client: LobbyClient,
    url: "/session",
  }),
  Client.layerSocket({
    client: ChatClient,
    url: "/session",
  }),
)
```

`layerSocket(...)` requires a `Socket.WebSocketConstructor` in the environment.

## `Client.layerWorker(...)`

Use worker transport when the actor lives in a worker, a `MessagePort`, or another browser-local runtime.

```ts
import { Layer } from "effect"
import { Client } from "liminal"

const NotificationLive = Layer.mergeAll(
  NotificationAccumulator.layer.pipe(
    Layer.provideMerge(
      Client.layerWorker({ client: NotificationClient }).pipe(Layer.provide(NotificationWorker.layer)),
    ),
  ),
)
```

`layerWorker(...)` needs a `Worker.PlatformWorker` and `Worker.Spawner` in the environment. The exact provider depends
on whether you are using a real worker, a platform bridge, or a message port.

## TODO: rest
