import { fileURLToPath, URL } from "node:url"

import tailwind from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  envDir: "../..",
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      generatedRouteTree: "routeTree.gen.ts",
      routesDirectory: "routes",
      target: "react",
    }),
    react(),
    tailwind(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
    dedupe: ["react", "react-dom", "effect"],
    tsconfigPaths: true,
  },
  environments: {
    ssr: {
      build: {
        rolldownOptions: { input: "../api/main.ts" },
      },
    },
  },
})
