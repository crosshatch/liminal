import { Schema as S, Effect, Cause, Encoding } from "effect"
import { NativeRequest } from "effect-workerd"
import { HttpServerResponse } from "effect/unstable/http"
import type { Method } from "../Method.ts"
import type { TopFromString } from "../_util/schema.ts"

export interface ActorHandle<
  NamespaceSelf,
  Methods extends Record<string, Method>,
  Name extends TopFromString,
  AttachmentFields extends S.Struct.Fields,
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

  readonly call: <K extends keyof Methods, M extends Methods[K]>(
    method: K,
    payload: M["payload"]["Type"],
  ) => Effect.Effect<M["success"]["Type"], M["failure"]["Type"], NamespaceSelf>
}
