import { Config, Effect, Layer, Redacted, Stream } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

export const layer = ({ endpoint, headers: configuredHeaders }: {
  readonly endpoint: string
  readonly headers?: HeadersInit | undefined
}) =>
  HttpRouter.addAll(
    (["/v1/traces", "/v1/logs", "/v1/metrics"] as const).map((path) =>
      HttpRouter.route(
        "POST",
        path,
        Effect.gen(function* () {
          const { headers: initialHeaders, method, stream, url } = yield* HttpServerRequest.HttpServerRequest
          const headers = new globalThis.Headers(initialHeaders)
          if (configuredHeaders !== undefined) {
            for (const [name, value] of new globalThis.Headers(configuredHeaders)) {
              headers.set(name, value)
            }
          }
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
          const upstream = yield* Effect.promise(() =>
            fetch(new URL(url, endpoint), { body, headers, method } as RequestInit),
          )
          const responseBody =
            upstream.body === null ? null : new Uint8Array(yield* Effect.promise(() => upstream.arrayBuffer()))
          return responseBody === null
            ? HttpServerResponse.empty({
                headers: upstream.headers,
                status: upstream.status,
                statusText: upstream.statusText,
              })
            : HttpServerResponse.uint8Array(responseBody, {
                headers: upstream.headers,
                status: upstream.status,
                statusText: upstream.statusText,
              })
        }),
      ),
    ),
  )

export const layerFromConfig = () =>
  Config.all({
    endpoint: Config.string("OTEL_EXPORTER_OTLP_ENDPOINT"),
    headers: Config.redacted("OTEL_EXPORTER_OTLP_HEADERS").pipe(Config.withDefault(Redacted.make(""))),
  }).pipe(
    Effect.map(({ endpoint, headers }) =>
      layer({
        endpoint,
        headers: parseHeaders(Redacted.value(headers)),
      })
    ),
    Layer.unwrap,
  )

const parseHeaders = (input: string): HeadersInit | undefined => {
  const headers = new globalThis.Headers()

  for (const part of input.split(",")) {
    const index = part.indexOf("=")
    if (index === -1) continue

    const name = decodeURIComponent(part.slice(0, index).trim())
    const value = decodeURIComponent(part.slice(index + 1).trim())
    if (name !== "") {
      headers.set(name, value)
    }
  }

  return headers.entries().next().done === true ? undefined : headers
}

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
