import { cloudflare } from "@cloudflare/vite-plugin"
import tailwind from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  envDir: "../..",
  plugins: [
    cloudflare(),
    tanstackRouter({
      autoCodeSplitting: true,
      generatedRouteTree: "routeTree.gen.ts",
      routesDirectory: "routes",
      target: "react",
    }),
    tsconfigPaths({
      projects: ["tsconfig.json"],
    }),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwind(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
    dedupe: ["react", "react-dom", "effect"],
  },
  server: {
    allowedHosts: [".localhost"],
    fs: { strict: false },
    host: "127.0.0.1",
    port: 7780,
    strictPort: true,
  },
})
