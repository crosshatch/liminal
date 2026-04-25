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

export type Handler<MethodDefinition extends Any, R> = (
  payload: MethodDefinition["payload"]["Type"],
) => Effect.Effect<MethodDefinition["success"]["Type"], MethodDefinition["failure"]["Type"], R>

export type Handlers<MethodDefinitions extends Record<string, Any>, R> = {
  [K in keyof MethodDefinitions]: Handler<MethodDefinitions[K], R>
}

export const handler = <M extends Any, R>(_method: M, f: Handler<M, R>): Handler<M, R> => f
