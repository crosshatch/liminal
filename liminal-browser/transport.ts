import type { ActorTransport } from "liminal"

import { Effect } from "effect"

export const transport: ActorTransport<MessagePort> = {
  send: (port, value) => Effect.sync(() => port.postMessage(value)),
  close: (port) => Effect.sync(() => port.close()),
}
