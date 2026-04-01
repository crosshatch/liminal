import { Function, Record, PubSub, Context, Effect, Schema as S, Layer, Stream, Ref } from "effect"

import type { FieldsRecord, Fields } from "./_types.ts"

import * as Reducer from "./Reducer.ts"

export const TypeId = "~liminal/Accumulator" as const

export interface AccumulatorDefinition<F extends Fields, EventDefinitions extends FieldsRecord> {
  readonly fields: F

  readonly events: EventDefinitions
}

export interface Service<F extends Fields> {
  readonly ref: Ref.Ref<S.Struct<F>["Type"]>

  readonly signals: {
    readonly [K in keyof F]: PubSub.PubSub<S.Schema.Type<F[K]>>
  }
}

const apply = Effect.fnUntraced(function* <A, E = never, R = never>(
  value: A,
  setter: A | Effect.Effect<A, E, R> | ((value: A) => A | Effect.Effect<A, E, R>),
): Effect.fn.Return<A, E, R> {
  if (Effect.isEffect(setter)) {
    return yield* setter
  } else if (Function.isFunction(setter)) {
    const applied = setter(value)
    if (Effect.isEffect(applied)) {
      return yield* applied
    }
    return applied
  }
  return setter
})

type AccumulatorSet<Self, F extends Fields> = <E = never, R = never>(
  setter:
    | S.Struct<F>["Type"]
    | Effect.Effect<S.Struct<F>["Type"], E, R>
    | ((value: S.Struct<F>["Type"]) => S.Struct<F>["Type"] | Effect.Effect<S.Struct<F>["Type"], E, R>),
) => Effect.Effect<void, E, R | Self>

type AccumulatorUpdate<Self, F extends Fields> = <K extends keyof F, E = never, R = never>(
  key: K,
  setter:
    | S.Schema.Type<F[K]>
    | Effect.Effect<S.Schema.Type<F[K]>, E, R>
    | ((value: S.Schema.Type<F[K]>) => S.Schema.Type<F[K]> | Effect.Effect<S.Schema.Type<F[K]>, E, R>),
) => Effect.Effect<void, E, R | Self>

type AccumulatorSignal<Self, F extends Fields> = <K extends keyof F>(
  key: K,
) => Stream.Stream<S.Schema.Type<F[K]>, never, Self>

export interface Accumulator<
  Self,
  Id extends string,
  F extends Fields,
  EventDefinitions extends FieldsRecord,
> extends Context.Tag<Self, Service<F>> {
  new (_: never): Context.TagClassShape<Id, Service<F>>

  readonly [TypeId]: typeof TypeId

  readonly definition: AccumulatorDefinition<F, EventDefinitions>

  readonly state: Effect.Effect<S.Struct<F>["Type"], never, Self>

  readonly reducer: <Tag extends keyof EventDefinitions, E, R>(
    tag: Tag,
    f: Reducer.Reducer<S.Struct<EventDefinitions[Tag]>["Type"], F, E, R>,
  ) => Reducer.Reducer<S.Struct<EventDefinitions[Tag]>["Type"], F, E, R>

  readonly update: <E = never, R = never>(
    setter:
      | S.Struct<F>["Type"]
      | Effect.Effect<S.Struct<F>["Type"], E, R>
      | ((value: S.Struct<F>["Type"]) => S.Struct<F>["Type"] | Effect.Effect<S.Struct<F>["Type"], E, R>),
  ) => Effect.Effect<void, E, R | Self>

  readonly updateField: AccumulatorUpdate<Self, F>

  readonly signal: AccumulatorSignal<Self, F>

  readonly current: Effect.Effect<S.Struct<F>["Type"], never, Self>

  readonly layer: <Reducers extends Reducer.Reducers<F, EventDefinitions>, E, R>(config: {
    readonly source: Stream.Stream<FieldsRecord.TaggedMember.Type<EventDefinitions>, E, R>
    readonly reducers: Reducers
    readonly initial: S.Struct<F>["Type"]
  }) => Layer.Layer<
    Self,
    E | Effect.Effect.Error<ReturnType<Reducers[keyof Reducers]>>,
    Exclude<R | Stream.Stream.Context<ReturnType<Reducers[keyof Reducers]>>, Self>
  >
}

export const Service =
  <Self>() =>
  <Id extends string, F extends Fields, EventDefinitions extends FieldsRecord>(
    id: Id,
    definition: AccumulatorDefinition<F, EventDefinitions>,
  ): Accumulator<Self, Id, F, EventDefinitions> => {
    const tag = Context.Tag(id)<Self, Service<F>>()

    const state = Effect.gen(function* () {
      const { ref: accumulator } = yield* tag
      return yield* Ref.get(accumulator)
    })

    const reducer = <Tag extends keyof EventDefinitions, E, R>(
      _tag: Tag,
      f: Reducer.Reducer<S.Struct<EventDefinitions[Tag]>["Type"], F, E, R>,
    ): Reducer.Reducer<S.Struct<EventDefinitions[Tag]>["Type"], F, E, R> => f

    const update: AccumulatorSet<Self, F> = Effect.fnUntraced(function* (setter) {
      const { ref, signals } = yield* tag
      let current = yield* Ref.get(ref)
      current = yield* apply(current, setter)
      yield* Ref.set(ref, current)
      for (let [key, signal] of Record.toEntries(signals)) {
        yield* signal.publish(current[key as keyof typeof current] as never)
      }
    })

    const updateField: AccumulatorUpdate<Self, F> = Effect.fnUntraced(function* (key, setter) {
      const { ref, signals } = yield* tag
      const previous = yield* Ref.get(ref)
      let current = previous[key as keyof typeof previous]
      current = yield* apply(current as never, setter)
      yield* Ref.set(ref, { ...previous, [key]: current })
      yield* signals[key].publish(current as never)
    })

    const signal = <K extends keyof F>(key: K) =>
      Effect.gen(function* () {
        const { signals } = yield* tag
        const signal = signals[key]
        return Stream.fromPubSub(signal)
      }).pipe(Stream.unwrap)

    const current = tag.pipe(Effect.flatMap(({ ref }) => Ref.get(ref)))

    const layer = <Reducers extends Reducer.Reducers<F, EventDefinitions>, E, R>({
      source,
      reducers,
      initial,
    }: {
      readonly source: Stream.Stream<FieldsRecord.TaggedMember.Type<EventDefinitions>, E, R>
      readonly reducers: Reducers
      readonly initial: S.Struct<F>["Type"]
    }): Layer.Layer<
      Self,
      E | Effect.Effect.Error<ReturnType<Reducers[keyof Reducers]>>,
      Exclude<R | Stream.Stream.Context<ReturnType<Reducers[keyof Reducers]>>, Self>
    > =>
      Effect.gen(function* () {
        const mutex = yield* Effect.makeSemaphore(1)
        const ref = yield* Ref.make(initial)
        const signals: {
          readonly [K in keyof F]: PubSub.PubSub<S.Schema.Type<F[K]>>
        } = (yield* Effect.all(
          Record.keys(definition.fields).map(
            Effect.fnUntraced(function* (key) {
              const pubsub = yield* PubSub.unbounded({ replay: 1 })
              yield* pubsub.publish(initial[key as never] as never)
              return [key, pubsub] as const
            }),
          ),
        ).pipe(Effect.map(Record.fromEntries))) as never
        const service: Service<F> = { ref, signals }
        yield* source.pipe(
          Stream.runForEach(
            Effect.fnUntraced(function* (event) {
              const { _tag, ...payload } = event
              const reducer = reducers[_tag]!
              const resolved = yield* Ref.get(ref)
              yield* reducer(payload as never, resolved)
            }, mutex.withPermits(1)),
          ),
          Effect.provideService(tag, service),
          Effect.forkScoped,
        )
        return service
      }).pipe(Layer.scoped(tag))

    return Object.assign(tag, {
      [TypeId]: TypeId,
      state,
      definition,
      reducer,
      update,
      updateField,
      signal,
      current,
      layer,
    })
  }
