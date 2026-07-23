import type { TopFromString } from "@crosshatch/util/schema"
import { Schema as S, Effect, Cause, Encoding } from "effect"
import { NativeRequest } from "effect-workerd"
import { HttpServerResponse } from "effect/unstable/http"

import type { Send } from "./ClientHandle.ts"
import type { Methods } from "./Method.ts"
import type { ProtocolDefinition } from "./Protocol.ts"

export interface ActorHandle<
  NamespaceSelf,
  Internal extends Methods,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
  D extends ProtocolDefinition,
> {
  readonly upgrade: (
    attachments: S.Struct<AttachmentFields>["Type"],
  ) => Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    S.SchemaError | Encoding.EncodingError | Cause.NoSuchElementError,
    | NamespaceSelf
    | NativeRequest.NativeRequest
    | Name["EncodingServices"]
    | S.Struct<AttachmentFields>["EncodingServices"]
  >

  readonly call: <K extends keyof Internal, M extends Internal[K]>(
    method: K,
    payload: M["payload"]["Type"],
  ) => Effect.Effect<M["success"]["Type"], M["failure"]["Type"], NamespaceSelf>

  readonly proxySendAll: Send<D, NamespaceSelf>
}
