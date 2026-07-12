import { defineConfig } from "oxlint"

import { baseConfig } from "./konfik/oxlint/baseConfig.ts"
import { defineReactConfig } from "./konfik/oxlint/defineReactConfig.ts"

export default defineConfig({
  env: { browser: true },
  extends: [baseConfig, defineReactConfig(["examples/*/app/**/*"])],
  ignorePatterns: ["**/*.gen.ts", "**/routeTree.gen.ts", "repos"],
  jsPlugins: [
    {
      name: "custom",
      specifier: "./konfik/oxlint/rules/index.ts",
    },
  ],
  rules: {
    "custom/require-readonly-type-members": "error",
  },
})
