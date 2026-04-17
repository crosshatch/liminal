import { cloudflare } from "@cloudflare/vite-plugin"
import tailwind from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"

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
  server: {
    allowedHosts: [".localhost"],
    fs: { strict: false },
    host: "127.0.0.1",
    port: 7780,
    strictPort: true,
  },
})
