import { Effect, flow } from "effect"
import { tapLogCause } from "liminal/_util/tapLogCause"

export const mapInternalError = flow(tapLogCause, Effect.orDie)
