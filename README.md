# Liminal Actors

**Liminal** is an Effect actor framework optimized for Cloudflare durable objects over hibernatable websocket.

- Client attachments are automatically persist across hibernations.
- Effect schemas describe a single source of truth for actor runtime implementation and client interaction.
- Effect-native Cloudflare APIs: D1, KV, Hyperdrive, and Assets––all with automatic binding validation.
- Derive Effect atoms from accumulator streams; create an `Accumulator` service, which reduces actor events into the
  client-specific frontier state.
- Audition protocol for graceful handling of endpoints that route to multiple actor types. When a client attempts to
  connect to an actor, the protocol validates that it is compatible with the given actor. Mismatches are rejected with a
  recoverable error.
- Structured logging and OTEL-compatible span tracing; every operation is instrumented.

## Contributing

To contribute, please read our [contributing guideline](https://github.com/crosshatch/konfik/blob/main/CONTRIBUTING.md).

## License

This library is licensed under [the Apache 2.0 License](https://github.com/crosshatch/konfik/blob/main/LICENSE).
