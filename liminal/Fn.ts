import { Effect, Schema as S } from "effect"
import type { Method } from "./Method.ts"
import type { ClientError, UnresolvedError } from "./errors.ts"

export type FnPayload<Methods extends Record<string, Method>, K extends keyof Methods> = Methods[K]["payload"]["Type"]

export type FnError<Methods extends Record<string, Method>> = [
  Methods[keyof Methods]["failure"]["Type"] | ClientError | S.SchemaError | UnresolvedError,
][0]

export type FnEffect<Self, Methods extends Record<string, Method>, K extends keyof Methods> = Effect.Effect<
  Methods[K]["success"]["Type"],
  FnError<Methods>,
  Self
>

export interface Fn<Self, Methods extends Record<string, Method>> {
  <K extends keyof Methods>(tag: K): (payload: FnPayload<Methods, K>) => FnEffect<Self, Methods, K>

  <K extends keyof Methods, A>(
    tag: K,
    a: (effect: FnEffect<Self, Methods, K>, payload: FnPayload<Methods, K>) => A,
  ): (payload: FnPayload<Methods, K>) => A

  <K extends keyof Methods, A, B>(
    tag: K,
    a: (effect: FnEffect<Self, Methods, K>, payload: FnPayload<Methods, K>) => A,
    b: (value: A, payload: FnEffect<Self, Methods, K>) => B,
  ): (payload: FnPayload<Methods, K>) => B

  <K extends keyof Methods, A, B, C>(
    tag: K,
    a: (effect: FnEffect<Self, Methods, K>, payload: FnPayload<Methods, K>) => A,
    b: (value: A, payload: FnEffect<Self, Methods, K>) => B,
    c: (value: B, payload: FnEffect<Self, Methods, K>) => C,
  ): (payload: FnPayload<Methods, K>) => C

  <K extends keyof Methods, A, B, C, D>(
    tag: K,
    a: (effect: FnEffect<Self, Methods, K>, payload: FnPayload<Methods, K>) => A,
    b: (value: A, payload: FnEffect<Self, Methods, K>) => B,
    c: (value: B, payload: FnEffect<Self, Methods, K>) => C,
    d: (value: C, payload: FnEffect<Self, Methods, K>) => D,
  ): (payload: FnPayload<Methods, K>) => D

  <K extends keyof Methods, A, B, C, D, E>(
    tag: K,
    a: (effect: FnEffect<Self, Methods, K>, payload: FnPayload<Methods, K>) => A,
    b: (value: A, payload: FnEffect<Self, Methods, K>) => B,
    c: (value: B, payload: FnEffect<Self, Methods, K>) => C,
    d: (value: C, payload: FnEffect<Self, Methods, K>) => D,
    e: (value: D, payload: FnEffect<Self, Methods, K>) => E,
  ): (payload: FnPayload<Methods, K>) => D
}
