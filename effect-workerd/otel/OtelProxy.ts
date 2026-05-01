import { Effect, Stream } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

export const layer = ({ endpoint }: { readonly endpoint: string }) =>
  HttpRouter.addAll(
    (["/v1/traces", "/v1/logs", "/v1/metrics"] as const).map((path) =>
      HttpRouter.route(
        "POST",
        path,
        Effect.gen(function* () {
          const { headers: initialHeaders, method, stream, url } = yield* HttpServerRequest.HttpServerRequest
          const headers = new globalThis.Headers(initialHeaders)
          for (const name of hopByHopHeaders) {
            headers.delete(name)
          }
          const chunks = yield* Stream.runCollect(stream)
          const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
          const body = new Uint8Array(byteLength)
          let offset = 0
          for (const chunk of chunks) {
            body.set(chunk, offset)
            offset += chunk.byteLength
          }
          const upstream = yield* Effect.tryPromise(() =>
            fetch(new URL(url, endpoint), {
              body,
              headers,
              method,
            } as RequestInit),
          )
          return HttpServerResponse.fromWeb(
            new Response(upstream.body, {
              headers: upstream.headers,
              status: upstream.status,
              statusText: upstream.statusText,
            }),
          )
        }),
      ),
    ),
  )

const hopByHopHeaders = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])
