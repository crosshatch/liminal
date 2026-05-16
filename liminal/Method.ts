import { Schema as S, Effect } from "effect"

export interface Method {
  readonly payload: S.Top
  readonly success: S.Top
  readonly failure: S.Top
}

export type Methods = Record<string, Method>

export type Handler<M extends Method, R> = (
  payload: M["payload"]["Type"],
) => Effect.Effect<M["success"]["Type"], M["failure"]["Type"], R>

export const handler = <M extends Method, R>(_method: M, f: Handler<M, R>): Handler<M, R> => f

export type Handlers<Internal extends Methods, R> = {
  readonly [K in keyof Internal]: Handler<Internal[K], R>
}
