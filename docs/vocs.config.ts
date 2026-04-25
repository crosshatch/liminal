import PackageJson from "liminal/package.json" with { type: "json" }
import { defineConfig } from "vocs"

export default defineConfig({
  vite: {
    server: {
      host: "127.0.0.1",
      port: 7774,
      strictPort: true,
    },
  },
  title: "Liminal",
  aiCta: false,
  baseUrl: "https://liminal.actor",
  description: PackageJson.description,
  editLink: {
    pattern: "https://github.com/liminal/docs/edit/main/docs/pages/:path",
    text: "Edit on GitHub",
  },
  rootDir: ".",
  sidebar: {
    "/": [
      {
        link: "/",
        text: "Quickstart",
      },
      {
        link: "/cloudflare",
        text: "Cloudflare Quickstart",
      },
      {
        text: "Worker Runtime",
        items: [
          {
            link: "/cloudflare/worker",
            text: "Worker",
          },
          {
            link: "/cloudflare/native-request",
            text: "NativeRequest",
          },
        ],
      },
      {
        text: "Bindings",
        items: [
          {
            link: "/cloudflare/ai",
            text: "AI",
          },
          {
            link: "/cloudflare/assets",
            text: "Assets",
          },
          {
            link: "/cloudflare/d1",
            text: "D1",
          },
          {
            link: "/cloudflare/do-state",
            text: "Durable Object State",
          },
          {
            link: "/cloudflare/hyperdrive",
            text: "Hyperdrive",
          },
          {
            link: "/cloudflare/images",
            text: "Images",
          },
          {
            link: "/cloudflare/kv",
            text: "KV",
          },
          {
            link: "/cloudflare/r2",
            text: "R2",
          },
          {
            link: "/cloudflare/worker-loader",
            text: "Worker Loader",
          },
        ],
      },
      {
        text: "Persistence",
        items: [
          {
            link: "/cloudflare/key-value-store",
            text: "KeyValueStore on R2",
          },
        ],
      },
      {
        text: "Actor System",
        items: [
          {
            link: "/clients",
            text: "Clients",
          },
          {
            link: "/actors-handlers-and-lifecycle",
            text: "Actors, Handlers, and Lifecycle",
          },
          {
            link: "/accumulator",
            text: "Accumulator",
          },
          {
            link: "/audition",
            text: "Audition",
          },
          {
            link: "/cloudflare/registry-and-routing",
            text: "Registry and Routing",
          },
        ],
      },
    ],
  },
  socials: [
    {
      icon: "discord",
      link: "https://discord.gg/8AKkcWhE",
    },
    {
      icon: "github",
      link: "https://github.com/crosshatch/liminal",
    },
    {
      icon: "x",
      link: "https://x.com/CrosshatchDev",
    },
  ],
})
