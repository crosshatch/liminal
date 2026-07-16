import { Stack } from "alchemy"
import { ConfigProvider, Effect } from "effect"

export const layer = ConfigProvider.layerAdd(
  Stack.pipe(Effect.map(({ stage }) => ConfigProvider.fromUnknown({ ALCHEMY_STAGE: stage }))),
  { asPrimary: true },
)
