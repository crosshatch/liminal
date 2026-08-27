import type { Stream, Types } from "effect"

import type * as Client from "./Client.ts"

export interface Audition<C extends Record<string, Client.Any>> {
  readonly state: Stream.Stream<
    {
      readonly [K in keyof C]: { readonly _tag: K } & Stream.Success<C[K]["state"]>
    }[keyof C]
  >

  // TODO: formulate with mapped type that ensures each same-named method signature is identical
  readonly methods: Types.UnionToIntersection<C[keyof C]["methods"]>
}

export const make = <C extends Record<string, Client.Any>>(_value: C): Audition<C> => null!
