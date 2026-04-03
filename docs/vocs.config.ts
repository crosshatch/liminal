import PackageJson from "liminal/package.json" with { type: "json" }
import { defineConfig } from "vocs"

export default defineConfig({
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
        link: "/clients",
        text: "Clients",
      },
      {
        text: "Cloudflare",
        items: [
          {
            link: "/cloudflare",
            text: "Introduction",
          },
          {
            link: "/cloudflare/assets",
            text: "Assets",
          },
          {
            link: "/cloudflare/kv",
            text: "KV",
          },
          {
            link: "/cloudflare/hyperdrive",
            text: "Hyperdrive",
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
