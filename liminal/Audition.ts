import { Stream, Types } from "effect"

import * as Client from "./Client.ts"

export interface Audition<C extends Record<string, Client.Any>> {
  readonly state: Stream.Stream<
    {
      readonly [K in keyof C]: { readonly _tag: K } & Stream.Success<C[K]["state"]>
    }[keyof C],
    never
  >

  // TODO: formulate with mapped type that ensures each same-named method signature is identical
  readonly methods: Types.UnionToIntersection<C[keyof C]["methods"]>
}

export const make = <C extends Record<string, Client.Any>>(_value: C): Audition<C> => null!
