import { Schema as S, Effect } from "effect"

import type { Fields } from "./_types.ts"

export interface MethodDefinition<P extends Fields, AA, AI, EA, EI> {
  readonly payload: P
  readonly success: S.Schema<AA, AI>
  readonly failure: S.Schema<EA, EI>
}

export declare namespace MethodDefinition {
  export type Any = MethodDefinition<Fields, any, any, any, any> | MethodDefinition<Fields, any, any, never, never>

  export type Merge<T, U> = [T] extends [never]
    ? U
    : {
        [K in keyof T & keyof U]: T[K] extends U[K] ? (U[K] extends T[K] ? T[K] : never) : never
      }
}

export const define = <const P extends Fields, AA, AI, EA, EI>({
  payload,
  success,
  failure,
}: {
  readonly payload: P
  readonly success: S.Schema<AA, AI>
  readonly failure: S.Schema<EA, EI>
}): MethodDefinition<P, AA, AI, EA, EI> => ({ payload, success, failure })

export type Handler<MethodDefinition extends MethodDefinition.Any, R> = (
  payload: S.Struct<MethodDefinition["payload"]>["Type"],
) => Effect.Effect<MethodDefinition["success"]["Type"], MethodDefinition["failure"]["Type"], R>

export type Handlers<MethodDefinitions extends Record<string, MethodDefinition.Any>, R> = {
  [K in keyof MethodDefinitions]: Handler<MethodDefinitions[K], R>
}

export const handler = <M extends MethodDefinition.Any, R>(_method: M, f: Handler<M, R>): Handler<M, R> => f
