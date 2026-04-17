import { Layer } from "effect"
import { HttpClient, FetchHttpClient } from "effect/unstable/http"

import type { BindingError } from "./Binding.ts"

import { Assets } from "./Assets.ts"

export type Intrinsic = Assets | HttpClient.HttpClient

export const layer: Layer.Layer<Assets | HttpClient.HttpClient, BindingError> = Layer.mergeAll(
  Assets.layer,
  FetchHttpClient.layer,
)
