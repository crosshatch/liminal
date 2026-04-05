import { Types, Effect } from "effect"

export type Reduce<Accumulator, Item, K extends Types.Tags<Item> = Types.Tags<Item>, E = never, R = never> = (
  item: Types.ExtractTag<Item, K>,
) => (accumulator: Accumulator) => Effect.Effect<Accumulator, E, R>

export const arm =
  <Accumulator, Item>() =>
  <K extends Types.Tags<Item>, E, R>(
    _tag: K,
    f: (item: Types.ExtractTag<Item, K>) => (accumulator: Accumulator) => Effect.Effect<Accumulator, E, R>,
  ): Reduce<Accumulator, Item, K, E, R> =>
    f
