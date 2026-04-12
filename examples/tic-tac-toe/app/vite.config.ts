import { fileURLToPath, URL } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwind from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  envDir: "../..",
  optimizeDeps: {
    exclude: ["@effect/platform"],
    include: ["@effect-atom/atom", "@effect-atom/atom-react"],
  },
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
    dedupe: [
      "react",
      "react-dom",
      "effect",
      "@effect-atom/atom",
      "@effect-atom/atom-react",
    ],
  },
  server: {
    allowedHosts: [".localhost"],
    fs: { strict: false },
    host: "127.0.0.1",
    port: 4567,
    strictPort: true,
  },
});
