import { Effect } from "effect"

export interface ActorTransport<T> {
  readonly send: (transport: T, value: string) => Effect.Effect<void>

  readonly close: (transport: T) => Effect.Effect<void>
}
