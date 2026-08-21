import { SocketProtocols } from "@crosshatch/util"
import { DurableObjectState } from "alchemy/Cloudflare"
import { Effect } from "effect"
import { HttpBody, HttpServerResponse } from "effect/unstable/http"

export const upgrade = Effect.gen(function* () {
  const state = yield* DurableObjectState
  const { 0: client, 1: server } = new WebSocketPair()
  state.acceptWebSocket(server as never)
  const rawResponse = new Response(null, {
    status: 101,
    webSocket: client,
    headers: { [SocketProtocols.SocketProtocolsKey]: "liminal" },
  })
  const response = HttpServerResponse.setBody(HttpServerResponse.empty({ status: 101 }), HttpBody.raw(rawResponse))
  return [response, server] as const
})

// TODO: close protocol shape
export const openClose = Effect.fnUntraced(function* (reason: string) {
  const { 0: webSocket, 1: server } = new WebSocketPair()
  server.accept()
  server.send(reason)
  server.close(1000)
  return new Response(null, {
    status: 101,
    webSocket,
    headers: { [SocketProtocols.SocketProtocolsKey]: "liminal" },
  })
})
