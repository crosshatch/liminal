import { Schema as S } from "effect"

export type Normalize<T, K> = K extends keyof T
  ? T[K] extends S.Struct.Fields
    ? S.Struct<T[K]>
    : T[K] extends S.Top
      ? T[K]
      : S.Void
  : S.Void

export type WithDefault<T, K extends keyof T, F extends T[K]> = K extends keyof T
  ? T[K] extends undefined
    ? F
    : Exclude<T[K], undefined>
  : F
