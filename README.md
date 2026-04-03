# Liminal

Effect-first actors for WebSockets, workers, and Cloudflare Durable Objects.

> Note: Liminal is unstable. Use at your peril.

## Packages

- `liminal`: core protocol, actor, client, method, `Audition`, and `Accumulator` primitives
- `liminal-cloudflare`: Durable Object registry, Worker entrypoint, and Cloudflare resource helpers such as Assets, Hyperdrive, and KV
- `liminal-browser`: browser-local actor hosting via `Singleton.make(...)`

## Core model

Most apps follow the same shape:

1. Define a protocol with `Client.Service(...)`
2. Define a server runtime with `Actor.Service(...)`
3. Implement handlers and an `onConnect` hook
4. Mount the actor in a transport such as `ActorRegistry` or `Singleton`
5. Consume the client with `Client.layerSocket(...)` or `Client.layerWorker(...)`
6. Optionally aggregate and reduce events with `Audition` and `Accumulator`

## Recommended reading order

1. [Quickstart: Cloudflare](./docs/01-quickstart-cloudflare.md)
2. [Clients and Methods](./docs/02-clients-and-methods.md)
3. [Actors, Handlers, and Lifecycle](./docs/03-actors-handlers-and-lifecycle.md)
4. [Cloudflare Registry and Routing](./docs/04-cloudflare-registry-and-routing.md)
5. [State Sync with Audition and Accumulator](./docs/05-state-sync-with-audition-and-accumulator.md)
6. [Browser and Worker Transports](./docs/06-browser-and-worker-transports.md)
7. [Operational Notes](./docs/07-operational-notes.md)

## Cloudflare Resource Guides

- [Cloudflare Assets](./docs/08-cloudflare-assets.md)
- [Cloudflare Hyperdrive](./docs/09-cloudflare-hyperdrive.md)
- [Cloudflare KV](./docs/10-cloudflare-kv.md)

## Patterns this repo actually uses

The docs above are organized around the patterns visible in this codebase:

- separate `Method.define(...)` modules under `methods/`
- shared handlers built with `Method.handler(...)`
- snapshot events emitted from `onConnect`
- request-local context derived in `runLayer`
- UI state reduced with `Audition` and `Accumulator`
- both WebSocket and worker/message-port transports

If you want the shortest path, start with the quickstart and then jump straight to the state-sync guide.
