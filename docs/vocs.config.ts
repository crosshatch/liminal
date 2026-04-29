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
        text: "Overview",
      },
      {
        link: "/start",
        text: "Quickstart",
      },
      {
        text: "Client",
        items: [
          {
            link: "/core/clients",
            text: "Clients",
          },
          {
            link: "/core/methods",
            text: "Methods",
          },
          {
            link: "/core/client-calls",
            text: "Client Calls",
          },
          {
            link: "/core/events",
            text: "Events",
          },
          {
            link: "/core/client-layer",
            text: "Client Layer",
          },
        ],
      },
      {
        text: "Actor",
        items: [
          {
            link: "/core/actors",
            text: "Actors",
          },
          {
            link: "/core/actor-context",
            text: "Actor Context",
          },
          {
            link: "/core/actor-handlers",
            text: "Actor Handlers",
          },
          {
            link: "/core/lifecycle",
            text: "Lifecycle",
          },
          {
            link: "/core/client-handles",
            text: "Client Handles",
          },
          {
            link: "/core/actor-namespace",
            text: "Actor Namespace",
          },
          {
            link: "/core/prelude-vs-layer",
            text: "Prelude vs Layer",
          },
        ],
      },
      {
        text: "Actor Routing",
        items: [
          {
            link: "/actor-routing/upgrades",
            text: "Upgrades",
          },
          {
            link: "/actor-routing/worker-entrypoint",
            text: "Worker Entrypoint",
          },
        ],
      },
      {
        text: "State",
        items: [
          {
            link: "/state/accumulator",
            text: "Accumulator",
          },
          {
            link: "/state/snapshot-delta-events",
            text: "Snapshot and Delta Events",
          },
          {
            link: "/state/audition",
            text: "Audition",
          },
        ],
      },
      {
        text: "Instrumentation",
        items: [
          {
            link: "/instrumentation",
            text: "Overview",
          },
          {
            link: "/instrumentation/propagation",
            text: "Propagation",
          },
          {
            link: "/instrumentation/session-continuity",
            text: "Session Continuity",
          },
          {
            link: "/instrumentation/trace-story",
            text: "Trace Story",
          },
          {
            link: "/instrumentation/browser-setup",
            text: "Browser Setup",
          },
          {
            link: "/instrumentation/cloudflare-setup",
            text: "Cloudflare Setup",
          },
          {
            link: "/instrumentation/collectors",
            text: "Collectors",
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
