import { Schema as S } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

export class Api extends HttpApi.make("meta_api").add(
  HttpApiGroup.make("workers")
    .add(
      HttpApiEndpoint.get("make", "/deploy", {
        params: S.Struct({
          runtime: S.String,
          payload: S.Json,
          success: S.Json,
          failure: S.Json,
        }),
        success: S.Struct({
          id: S.String,
        }),
      }),
    )
    .prefix("/workers"),
) {}
