import { SocketProtocols } from "@crosshatch/util"
import { Effect } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

import { DurableObjectState } from "./DurableObjectState.ts"

const response = (webSocket: WebSocket) =>
  new Response(null, {
    status: 101,
    headers: { [SocketProtocols.SocketProtocolsKey]: "liminal" },
    webSocket,
  })

export const upgrade = Effect.gen(function* () {
  const state = yield* DurableObjectState
  const { 0: client, 1: server } = new WebSocketPair()
  state.acceptWebSocket(server)
  return [HttpServerResponse.raw(response(client)), server] as const
})

// TODO: close protocol shape
export const openClose = (reason: string) =>
  Effect.sync(() => {
    const { 0: client, 1: server } = new WebSocketPair()
    server.accept()
    server.send(reason)
    server.close(1000)
    return response(client)
  })
