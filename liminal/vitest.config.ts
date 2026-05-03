import { mergeConfig, type ViteUserConfig } from "vitest/config"

import config from "../konfik/vitest.ts"

export default mergeConfig(config, {
  test: { name: "liminal" },
} satisfies ViteUserConfig)
