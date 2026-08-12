import { SocketProtocolsKey } from "@crosshatch/util/SocketProtocols"
import { Effect } from "effect"
import { HttpBody, HttpServerResponse } from "effect/unstable/http"

import { NativeDurableObjectState } from "./adapters.ts"

export const upgrade = Effect.gen(function* () {
  const state = yield* NativeDurableObjectState
  const { 0: client, 1: server } = new WebSocketPair()
  state.acceptWebSocket(server)
  const rawResponse = new Response(null, {
    status: 101,
    webSocket: client,
    headers: { [SocketProtocolsKey]: "liminal" },
  })
  const response = HttpServerResponse.setBody(HttpServerResponse.empty({ status: 101 }), HttpBody.raw(rawResponse))
  return [response, server] as const
})

// TODO: close protocol shape
export const close = Effect.fnUntraced(function* (reason: string) {
  const [response, server] = yield* upgrade
  server.send(reason)
  server.close(1000)
  return response
})
