import { HttpClient, FetchHttpClient } from "@effect/platform"
import { Layer } from "effect"

import { Assets } from "./Assets.ts"
import type { BindingError } from "./Binding.ts"

export type Intrinsic = Assets | HttpClient.HttpClient

export const layer: Layer.Layer<Assets | HttpClient.HttpClient, BindingError> = Layer.mergeAll(
  Assets.layer,
  FetchHttpClient.layer,
)
