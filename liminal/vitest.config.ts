import { mergeConfig, type ViteUserConfig } from "vitest/config"

import config from "../konfik/vitest.ts"
import PackageJson from "./package.json" with { type: "json" }

export default mergeConfig(config, {
  test: {
    name: PackageJson.name,
  },
} satisfies ViteUserConfig)
