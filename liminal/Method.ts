import { Effect, Schema as S, Stream } from "effect"

import type * as Definition from "./Definition.ts"

export type Side = "client" | "actor" | "both" | "neither"

export interface MethodDefinition {
  readonly side?: Side | undefined
  readonly payload?: S.Top | S.Struct.Fields | undefined
  readonly success?: S.Top | S.Struct.Fields | undefined
  readonly error?: S.Top | undefined
  readonly stream?: boolean | undefined
}

export type MethodDefinitions = Record<string, MethodDefinition>

export interface MethodProtocol {
  readonly side: Side
  readonly payload: S.Top
  readonly success: S.Top
  readonly error: S.Top
  readonly stream: boolean
}

export declare namespace MethodProtocol {
  export type FromDefinition<D extends MethodDefinition> = {
    readonly side: Definition.WithDefault<D, "side", "neither">
    readonly payload: Definition.Normalize<D, "payload">
    readonly success: Definition.Normalize<D, "success">
    readonly error: Definition.WithDefault<D, "error", S.Never>
    readonly stream: Definition.WithDefault<D, "stream", false>
  }
}

export type MethodProtocols = Record<string, MethodProtocol>

export declare namespace MethodProtocols {
  export type FromDefinitions<D extends MethodDefinitions> = {
    readonly [K in keyof D]: MethodProtocol.FromDefinition<D[K]>
  }
}

export type Method<P extends MethodProtocol, R> = (
  payload: P["payload"]["Type"],
) => P["stream"] extends true
  ? Stream.Stream<P["success"]["Type"], P["error"]["Type"], R>
  : Effect.Effect<P["success"]["Type"], P["error"]["Type"], R>

export type ClientMethods<P extends MethodProtocols, R> = {
  readonly [K in keyof P as P[K]["side"] extends "actor" | "neither" ? never : K]: Method<P[K], R>
}

export type ActorMethods<P extends MethodProtocols, R> = {
  readonly [K in keyof P as P[K]["side"] extends "client" | "neither" ? never : K]: Method<P[K], R>
}

export type Methods<P extends MethodProtocols, R> = {
  readonly [K in keyof P]: Method<P[K], R>
}

export type HandlerServices<H extends Record<string, (...args: ReadonlyArray<any>) => any>> = H[keyof H] extends (
  ...args: ReadonlyArray<any>
) => infer Return
  ? Return extends Effect.Effect<any, any, infer R>
    ? R
    : Return extends Stream.Stream<any, any, infer R>
      ? R
      : never
  : never

export const handler = <D extends MethodDefinition, R>(
  _definition: D,
  handler: Method<MethodProtocol.FromDefinition<D>, R>,
) => handler
