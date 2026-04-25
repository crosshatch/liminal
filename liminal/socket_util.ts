import { flow } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

export const SecWebSocketProtocol = "Sec-WebSocket-Protocol" as const

export const closeRaw = (event?: string | undefined) => {
  const { 0: webSocket, 1: server } = new WebSocketPair()
  server.accept()
  if (event) {
    server.send(event)
  }
  server.close(1000)
  return new Response(null, {
    status: 101,
    webSocket,
    headers: { [SecWebSocketProtocol]: "liminal" },
  })
}

export const close = flow(closeRaw, HttpServerResponse.raw)
