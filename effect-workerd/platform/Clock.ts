import { Clock, Effect, Layer, Duration } from "effect"

const currentTimeMillisUnsafe = () => Date.now()

const currentTimeNanosUnsafe = () => BigInt(Date.now()) * 1_000_000n

export const layer = Layer.succeed(Clock.Clock, {
  currentTimeMillisUnsafe,
  currentTimeMillis: Effect.sync(() => currentTimeMillisUnsafe()),
  currentTimeNanosUnsafe,
  currentTimeNanos: Effect.sync(() => currentTimeNanosUnsafe()),
  sleep: (duration) => {
    const millis = Duration.toMillis(duration)
    if (millis <= 0) return Effect.void
    return Effect.callback<void>((resume) => {
      const handle = setTimeout(() => resume(Effect.void), millis)
      return Effect.sync(() => clearTimeout(handle))
    })
  },
})
