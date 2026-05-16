import { Effect, Schema as S } from "effect"

import type { ClientError, UnresolvedError } from "./errors.ts"
import type { Methods } from "./Method.ts"

export type FnPayload<External extends Methods, K extends keyof External> = External[K]["payload"]["Type"]

export type FnError<External extends Methods, K extends keyof External> = [
  External[K]["failure"]["Type"] | ClientError | S.SchemaError | UnresolvedError,
][0]

export type FnEffect<Self, External extends Methods, K extends keyof External> = Effect.Effect<
  External[K]["success"]["Type"],
  FnError<External, K>,
  Self
>

export interface Fn<Self, Internal extends Methods> {
  <K extends keyof Internal>(tag: K): (payload: FnPayload<Internal, K>) => FnEffect<Self, Internal, K>

  <K extends keyof Internal, A>(
    tag: K,
    a: (effect: FnEffect<Self, Internal, K>, payload: FnPayload<Internal, K>) => A,
  ): (payload: FnPayload<Internal, K>) => A

  <K extends keyof Internal, A, B>(
    tag: K,
    a: (effect: FnEffect<Self, Internal, K>, payload: FnPayload<Internal, K>) => A,
    b: (value: A, payload: FnPayload<Internal, K>) => B,
  ): (payload: FnPayload<Internal, K>) => B

  <K extends keyof Internal, A, B, C>(
    tag: K,
    a: (effect: FnEffect<Self, Internal, K>, payload: FnPayload<Internal, K>) => A,
    b: (value: A, payload: FnPayload<Internal, K>) => B,
    c: (value: B, payload: FnPayload<Internal, K>) => C,
  ): (payload: FnPayload<Internal, K>) => C

  <K extends keyof Internal, A, B, C, D>(
    tag: K,
    a: (effect: FnEffect<Self, Internal, K>, payload: FnPayload<Internal, K>) => A,
    b: (value: A, payload: FnPayload<Internal, K>) => B,
    c: (value: B, payload: FnPayload<Internal, K>) => C,
    d: (value: C, payload: FnPayload<Internal, K>) => D,
  ): (payload: FnPayload<Internal, K>) => D

  <K extends keyof Internal, A, B, C, D, E>(
    tag: K,
    a: (effect: FnEffect<Self, Internal, K>, payload: FnPayload<Internal, K>) => A,
    b: (value: A, payload: FnPayload<Internal, K>) => B,
    c: (value: B, payload: FnPayload<Internal, K>) => C,
    d: (value: C, payload: FnPayload<Internal, K>) => D,
    e: (value: D, payload: FnPayload<Internal, K>) => E,
  ): (payload: FnPayload<Internal, K>) => E
}
