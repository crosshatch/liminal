import { Deferred, Types, Option, Ref, PubSub, Stream, Effect, Context, Layer, Semaphore } from "effect"

import * as Diagnostic from "./_util/Diagnostic.ts"

const { debug } = Diagnostic.module("Accumulator")

const TypeId = "~liminal/Accumulator" as const

export interface Service<State> {
  readonly ref: Ref.Ref<State>

  readonly pubsub: PubSub.PubSub<State>
}

export interface AccumulatorLayerConfig<Item, E, R, State, E2, R2, E3, R3> {
  readonly source: Stream.Stream<Item, E, R>

  readonly reduce: (item: Item) => (state: State) => Effect.Effect<State, E2, R2>

  readonly initial: (item: Item) => Effect.Effect<Option.Option<State>, E3, R3>
}

export type Reduce<State, Item, K extends Types.Tags<Item> = Types.Tags<Item>, E = never, R = never> = (
  item: Types.ExtractTag<Item, K>,
) => (accumulator: State) => Effect.Effect<State, E, R>

export interface Accumulator<Self, Id extends string, State> extends Context.Service<Self, Service<State>> {
  new (_: never): Context.ServiceClass.Shape<Id, Service<State>>

  readonly [TypeId]: typeof TypeId

  readonly get: Effect.Effect<State, never, Self>

  readonly stream: Stream.Stream<State, never, Self>

  readonly reducer: <Item>() => <K extends Types.Tags<Item>, E, R>(
    _tag: K,
    f: Reduce<State, Item, K, E, R>,
  ) => Reduce<State, Item, K, E, R>

  readonly layer: <Item, E, R, E2, R2, E3, R3>(
    config: AccumulatorLayerConfig<Item, E, R, State, E2, R2, E3, R3>,
  ) => Layer.Layer<Self, E | E2 | E3, R | R2 | R3>
}

export const Service =
  <Self, State>() =>
  <Id extends string>(id: Id): Accumulator<Self, Id, State> => {
    const tag = Context.Service<Self, Service<State>>()(id)

    const get = tag.asEffect().pipe(
      Effect.map(({ ref }) => ref),
      Effect.flatMap(Ref.get),
    )

    const stream = tag.asEffect().pipe(
      Effect.map(({ pubsub }) => Stream.fromPubSub(pubsub)),
      Stream.unwrap,
    )

    const reducer =
      <Item>() =>
      <K extends Types.Tags<Item>, E, R>(_tag: K, f: Reduce<State, Item, K, E, R>): Reduce<State, Item, K, E, R> =>
        f

    const layer = <Item, E, R, E2, R2, E3, R3>({
      source,
      initial,
      reduce,
    }: AccumulatorLayerConfig<Item, E, R, State, E2, R2, E3, R3>): Layer.Layer<Self, E | E2 | E3, R | R2 | R3> =>
      Effect.gen(function* () {
        const semaphore = yield* Semaphore.make(1)
        const deferred = yield* Deferred.make<State>()
        const pubsub = yield* PubSub.unbounded<State>({ replay: 1 })
        yield* source.pipe(
          Stream.runForEach(
            Effect.fn(function* (item) {
              if (!(yield* Deferred.isDone(deferred))) {
                const match = yield* initial(item)
                if (Option.isSome(match)) {
                  const { value } = match
                  yield* Deferred.succeed(deferred, value)
                  yield* debug("InitializedState", { state: value })
                }
                return
              }
              const current = yield* Ref.get(ref)
              const reduced = yield* reduce(item)(current)
              yield* Ref.set(ref, reduced)
              yield* PubSub.publish(pubsub, reduced)
              yield* debug("ReducedState", { item, previous: current, current: reduced })
            }, semaphore.withPermits(1)),
          ),
          Effect.forkScoped,
        )
        const initial_ = yield* Deferred.await(deferred)
        const ref = yield* Ref.make(initial_)
        yield* PubSub.publish(pubsub, initial_)
        return { ref, pubsub }
      }).pipe(Layer.effect(tag))

    return Object.assign(tag, { [TypeId]: TypeId, get, stream, reducer, layer })
  }
