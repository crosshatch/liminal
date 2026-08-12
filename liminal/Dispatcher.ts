import { Context, Effect } from "effect"
import type { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

const TypeId = "~liminal/Dispatcher" as const

export interface Dispatcher<Self> {
  readonly [TypeId]: typeof TypeId

  readonly "": Self
}

export type Dispatch = (
  name: string,
) => Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest>

class Dispatchers extends Context.Reference("liminal/Dispatcher/Dispatchers", {
  defaultValue: () => new Map(),
}) {}

export const getDispatcher = Effect.gen(function* () {
  const dispatchers = yield* Dispatchers
  console.log(dispatchers)
})
