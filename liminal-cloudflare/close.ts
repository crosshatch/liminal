import { flow } from "effect"
import { HttpServerResponse } from "effect/unstable/http"
import { SecWebSocketProtocol } from "liminal/_constants"

export const closeRaw = (status?: number | undefined, reason?: string | undefined) => {
  const { 0: webSocket, 1: server } = new WebSocketPair()
  server.accept()
  server.close(status, reason)
  return new Response(null, {
    status: 101,
    webSocket,
    headers: { [SecWebSocketProtocol]: "liminal" },
  })
}

export const close = flow(closeRaw, HttpServerResponse.raw)
