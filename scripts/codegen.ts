import * as OpenApiGenerator from "@effect/openapi-generator/OpenApiGenerator"
import { NodeServices, NodeChildProcessSpawner } from "@effect/platform-node"
import { Effect, FileSystem, Layer, Stream } from "effect"
import { FetchHttpClient, HttpClient } from "effect/unstable/http"
import { ChildProcess } from "effect/unstable/process"

Effect.gen(function* () {
  const generator = yield* OpenApiGenerator.OpenApiGenerator
  const parsed = yield* HttpClient.get(
    "https://raw.githubusercontent.com/cloudflare/api-schemas/refs/heads/main/openapi.json",
  ).pipe(Effect.flatMap((response) => response.json))
  const generated = yield* generator.generate(parsed as never, {
    name: "CloudflareClient",
    format: "httpclient",
  })
  const fs = yield* FileSystem.FileSystem
  const dest = new URL("../liminal-cloudflare/Generated.ts", import.meta.url).pathname
  yield* fs.writeFileString(dest, generated)
  const { stdout } = yield* ChildProcess.make`oxfmt`
  yield* stdout.pipe(Stream.runDrain)
}).pipe(
  Effect.scoped,
  Effect.provide([
    OpenApiGenerator.layerTransformerSchema,
    NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(NodeServices.layer)),
    FetchHttpClient.layer,
  ]),
  Effect.runFork,
)
