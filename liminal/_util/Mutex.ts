import { Context, Effect, Layer, Semaphore } from "effect"

export class Mutex extends Context.Service<
  Mutex,
  <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
>()("liminal-util/Mutex") {}

export const layer = Effect.gen(function* () {
  const mutex = yield* Semaphore.make(1)
  return mutex.withPermits(1)
}).pipe(Layer.effect(Mutex))

export const task = <A, E, R>(effect: Effect.Effect<A, E, R>) => Mutex.asEffect().pipe(Effect.flatMap((f) => f(effect)))
