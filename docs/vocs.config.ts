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
        ],
      },
      {
        text: "Cloudflare",
        items: [
          {
            link: "/cloudflare",
            text: "Quickstart",
          },
          {
            link: "/cloudflare/actor-namespace",
            text: "Actor Namespace",
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
