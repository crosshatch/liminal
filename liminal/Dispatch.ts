import type { Effect } from "effect"
import type { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

const TypeId = "~liminal/Dispatcher" as const

export interface Dispatch<Self> {
  readonly [TypeId]: typeof TypeId

  readonly "": Self
}

// TODO: rename
export type DispatchHandle = (
  name: string,
) => Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest>
