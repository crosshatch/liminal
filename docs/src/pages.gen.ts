// deno-fmt-ignore-file
// biome-ignore format: generated types do not need formatting
// prettier-ignore
import type { PathsForPages } from 'waku/router'

// prettier-ignore
type Page =
  | { path: '/actor-routing/upgrades'; render: 'static' }
  | { path: '/actor-routing/worker-entrypoint'; render: 'static' }
  | { path: '/changelog'; render: 'static' }
  | { path: '/core/actor-context'; render: 'static' }
  | { path: '/core/actor-handlers'; render: 'static' }
  | { path: '/core/actor-namespace'; render: 'static' }
  | { path: '/core/actors'; render: 'static' }
  | { path: '/core/client-calls'; render: 'static' }
  | { path: '/core/client-handles'; render: 'static' }
  | { path: '/core/client-layer'; render: 'static' }
  | { path: '/core/clients'; render: 'static' }
  | { path: '/core/events'; render: 'static' }
  | { path: '/core/lifecycle'; render: 'static' }
  | { path: '/core/methods'; render: 'static' }
  | { path: '/core/prelude-vs-layer'; render: 'static' }
  | { path: '/'; render: 'static' }
  | { path: '/instrumentation/browser-setup'; render: 'static' }
  | { path: '/instrumentation/cloudflare-setup'; render: 'static' }
  | { path: '/instrumentation/collectors'; render: 'static' }
  | { path: '/instrumentation'; render: 'static' }
  | { path: '/instrumentation/propagation'; render: 'static' }
  | { path: '/instrumentation/session-continuity'; render: 'static' }
  | { path: '/instrumentation/trace-story'; render: 'static' }
  | { path: '/start'; render: 'static' }
  | { path: '/state/audition'; render: 'static' }
  | { path: '/state/client-state'; render: 'static' }
  | { path: '/state/snapshot-delta-events'; render: 'static' }

// prettier-ignore
declare module 'waku/router' {
  interface RouteConfig {
    paths: PathsForPages<Page>
  }
  interface CreatePagesConfig {
    pages: Page
  }
}
