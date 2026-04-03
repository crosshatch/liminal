# Liminal

Effect-first actors for WebSockets, workers, and Cloudflare Durable Objects.

> Note: Liminal is unstable. Use at your peril.

## Packages

- `liminal`: core `Protocol`, `Actor`, `Client`, `Method`, `Audition`, `Accumulator`, and `Reducer` primitives
- `liminal-cloudflare`: Durable Object registry, Worker entrypoint, and Cloudflare resource helpers such as Assets, Hyperdrive, and KV
- `liminal-browser`: browser-local actor hosting via `Singleton`

## Core model

Most apps follow the same shape:

1. Define a protocol with `Client.Service(...)`
2. Define a server runtime with `Actor.Service(...)`
3. Implement handlers and an `onConnect` hook
4. Mount the actor in a transport such as `ActorRegistry` or `Singleton`
5. Consume the client with `Client.layerSocket(...)` or `Client.layerWorker(...)`
6. Optionally aggregate and reduce events with `Audition` and `Accumulator`

## Recommended reading order

1. [Quickstart: Cloudflare](./docs/quickstart-cloudflare.md)
2. [Clients and Methods](./docs/clients-and-methods.md)
3. [Actors, Handlers, and Lifecycle](./docs/actors-handlers-and-lifecycle.md)
4. [Cloudflare Registry and Routing](./docs/cloudflare/registry-and-routing.md)
5. [Audition](./docs/audition.md)
6. [Accumulator](./docs/accumulator.md)
7. [Browser and Worker Transports](./docs/browser/transports.md)

## Cloudflare Resource Guides

- [Cloudflare Assets](./docs/cloudflare/assets.md)
- [Cloudflare Hyperdrive](./docs/cloudflare/hyperdrive.md)
- [Cloudflare KV](./docs/cloudflare/kv.md)
