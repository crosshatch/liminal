import { createRouter } from "@tanstack/react-router"

import { routeTree } from "./routeTree.gen"

export const router = createRouter({
  context: {},
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  defaultStructuralSharing: true,
  routeTree,
  scrollRestoration: true,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
