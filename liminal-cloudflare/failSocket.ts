import { HttpServerResponse } from "@effect/platform"
import { Effect, flow, Schema as S } from "effect"
import { SecWebSocketProtocol } from "liminal/_constants"

export const failSocketRaw = Effect.fnUntraced(function* <A, I>(schema: S.Schema<A, I>, value: A) {
  const { 0: webSocket, 1: server } = new WebSocketPair()
  server.accept()
  server.close(4003, yield* S.encode(S.parseJson(schema))(value))
  return new Response(null, {
    status: 101,
    webSocket,
    headers: { [SecWebSocketProtocol]: "liminal" },
  })
})

export const failSocket = flow(failSocketRaw, Effect.map(HttpServerResponse.raw))
