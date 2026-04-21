import type { ActorTransport } from "liminal"

import { Effect } from "effect"

export const transport: ActorTransport<WebSocket> = {
  send: (socket, message) => Effect.sync(() => socket.send(message)),
  close: (socket) => Effect.sync(() => socket.close(1000)),
}
