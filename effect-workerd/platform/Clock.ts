import { Clock, Effect, Layer, Duration } from "effect"

const currentTimeMillisUnsafe = () => Date.now()

const currentTimeNanosUnsafe = () => BigInt(Date.now()) * 1_000_000n

const monotonicTimeNanosUnsafe = () => BigInt(Math.round(performance.now() * 1_000_000))

export const layer = Layer.succeed(Clock.Clock, {
  currentTimeMillisUnsafe,
  currentTimeMillis: Effect.sync(() => currentTimeMillisUnsafe()),
  currentTimeNanosUnsafe,
  currentTimeNanos: Effect.sync(() => currentTimeNanosUnsafe()),
  monotonicTimeNanosUnsafe,
  monotonicTimeNanos: Effect.sync(() => monotonicTimeNanosUnsafe()),
  sleep: (duration) => {
    const millis = Duration.toMillis(duration)
    if (millis <= 0) return Effect.void
    return Effect.callback<void>((resume) => {
      const handle = setTimeout(() => resume(Effect.void), millis)
      return Effect.sync(() => clearTimeout(handle))
    })
  },
})
