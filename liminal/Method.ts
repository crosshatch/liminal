import { Schema as S, Effect } from "effect"

export interface MethodDefinition<Payload extends S.Top, Success extends S.Top, Failure extends S.Top> {
  readonly payload: Payload
  readonly success: Success
  readonly failure: Failure
}

export type Any = MethodDefinition<S.Top, S.Top, S.Top>

export const make = <Payload extends S.Top, Success extends S.Top, Failure extends S.Top>({
  payload,
  success,
  failure,
}: {
  readonly payload: Payload
  readonly success: Success
  readonly failure: Failure
}): MethodDefinition<Payload, Success, Failure> => ({ payload, success, failure })

export type Handler<Method extends Any, R> = (
  payload: Method["payload"]["Type"],
) => Effect.Effect<Method["success"]["Type"], Method["failure"]["Type"], R>

export type Handlers<Methods extends Record<string, Any>, R> = {
  [K in keyof Methods]: Handler<Methods[K], R>
}

export const handler = <Method extends Any, R>(_method: Method, f: Handler<Method, R>): Handler<Method, R> => f
