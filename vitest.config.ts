import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      "./*/vitest.config.ts",
      "!./crosshatch/vitest.config.ts",
      "./crosshatch/@crosshatch/*/vitest.config.ts",
      "./crosshatch/crosshatch/vitest.config.ts",
    ],
  },
})
