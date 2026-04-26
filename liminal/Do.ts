export {}

// import { Effect, Schema as S, Context, Layer, ManagedRuntime } from "effect"
// import { HttpServerResponse } from "effect/unstable/http"

// import * as Binding from "./Binding.ts"
// import * as NativeRequest from "./NativeRequest.ts"

// export interface DoDefinition {
//   readonly name: S.Top & { Encoded: string }
// }

// export interface Do<Self, Id extends string, D extends DoDefinition> extends Context.Service<
//   Self,
//   DurableObjectNamespace
// > {
//   new (_: never): Context.ServiceClass.Shape<Id, DurableObjectNamespace>

//   readonly definition: D

//   readonly getByName: (name: D["name"]["Type"]) => Effect.Effect<void, S.SchemaError, Self>

//   readonly layer: (binding: string) => Layer.Layer<Self, S.SchemaError>
// }

// export const Do =
//   <Self>() =>
//   <Id extends string, D extends DoDefinition>(id: Id, definition: D): Do<Self, Id, D> => {
//     const encodeName = S.encodeEffect(definition.name)

//     return class tag extends Context.Service<Self, DurableObjectNamespace>()(id) {
//       static readonly getByName = Effect.fnUntraced(function* () {
//         throw 0
//       })

//       static readonly upgrade: (
//         name: D["name"]["Type"],
//       ) => Effect.Effect<
//         HttpServerResponse.HttpServerResponse,
//         never,
//         Self | NativeRequest.NativeRequest | D["name"]["EncodingServices"]
//       > = Effect.fnUntraced(function* (name) {
//         const ns = yield* tag
//         const nameEncoded = yield* encodeName(name)
//         const stub = ns.getByName(nameEncoded)
//         const request = yield* NativeRequest.NativeRequest
//         return yield* Effect.promise(() => stub.fetch(new Request(request))).pipe(Effect.map(HttpServerResponse.raw))
//       })

//       static readonly layer = Binding.layer(this, ["getByName"])

//       readonly runtime

//       constructor(...args: [never]) {
//         super(...args)
//         // const [state, env] = args as never as [state: globalThis.DurableObjectState<{}>, env: unknown]
//         this.runtime = ManagedRuntime.make(Layer.empty)

//         // if (hibernation) {
//         //   Option.andThen(
//         //     Duration.fromInput(hibernation),
//         //     flow(Duration.toMillis, state.setHibernatableWebSocketEventTimeout),
//         //   )
//         // }

//         // const baseLayer = Layer.mergeAll(
//         //   prelude.pipe(Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))),
//         //   FetchHttpClient.layer,
//         //   Layer.succeed(DoState.DoState, state),
//         //   Mutex.layer,
//         // )

//         // this.runtime = Effect.gen({ self: this }, function* () {
//         //   this.#name = yield* Effect.tryPromise(() => state.storage.get("__liminal_name")).pipe(
//         //     Effect.flatMap((v) => (typeof v === "string" ? decodeName(v) : Effect.succeed(undefined))),
//         //   )
//         //   for (const socket of state.getWebSockets()) {
//         //     const attachments = yield* decodeAttachments(socket.deserializeAttachment())
//         //     yield* this.directory.register(socket, attachments)
//         //   }
//         // }).pipe(
//         //   Effect.tapCause(logCause),
//         //   span("make_runtime"),
//         //   Layer.effectDiscard,
//         //   Layer.provideMerge(baseLayer),
//         //   boundLayer("actor"),
//         //   ManagedRuntime.make,
//         // )
//       }
//     } as never
//   }
