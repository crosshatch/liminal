import { defineConfig } from "oxlint"

import { baseConfig, rest } from "./konfik/oxlint/baseConfig.ts"
import { defineReactConfig } from "./konfik/oxlint/defineReactConfig.ts"

export default defineConfig({
  extends: [baseConfig, defineReactConfig(["examples/*/app/**/*", "crosshatch/docs/**/*"])],
  ...rest(),
})
