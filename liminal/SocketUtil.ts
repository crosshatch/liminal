import { SocketProtocols } from "@crosshatch/util"
import { DurableObjectState } from "alchemy/Cloudflare"
import { Effect } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

const response = (webSocket: WebSocket) =>
  new Response(null, {
    status: 101,
    webSocket,
    headers: { [SocketProtocols.SocketProtocolsKey]: "liminal" },
  })

export const upgrade = Effect.gen(function* () {
  const state = yield* DurableObjectState
  const { 0: client, 1: server } = new WebSocketPair()
  yield* state.acceptWebSocket(server as never)
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
