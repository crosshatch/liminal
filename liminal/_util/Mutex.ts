import { Context, Effect, Layer } from "effect"

export class Mutex extends Context.Tag("liminal/Mutex")<
  Mutex,
  <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
>() {}

export const layer = Effect.gen(function* () {
  const mutex = yield* Effect.makeSemaphore(1)
  return mutex.withPermits(1)
}).pipe(Layer.effect(Mutex))

export const task = <A, E, R>(effect: Effect.Effect<A, E, R>) => Mutex.pipe(Effect.flatMap((f) => f(effect)))
