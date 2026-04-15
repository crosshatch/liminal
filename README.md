# Liminal Actors

**Liminal** is an Effect actor framework optimized for Cloudflare durable objects over hibernatable websocket.

- Client attachments are automatically persist across hibernations.
- Type-safe client derivation.
- Effect-native Cloudflare APIs: D1, KV, Hyperdrive, and Assets––all with automatic binding validation.
- Effect Atom integration: use an `Accumulator` to reduce actor events into a frontier state stream (from which to
  derive a root state atom).
- Audition protocol for graceful handling of endpoints that route to multiple actor types. When a client attempts to
  connect to an actor, the protocol validates that it is compatible with the given actor. Mismatches are rejected with a
  recoverable error.
- Structured logging and OTEL-compatible span tracing; every operation is instrumented.
- Message processing is ordered to prevent race conditions related to concurrent socket messages.

## Contributing

To contribute, please read our [contributing guideline](https://github.com/crosshatch/konfik/blob/main/CONTRIBUTING.md).

## License

This library is licensed under [the Apache 2.0 License](https://github.com/crosshatch/konfik/blob/main/LICENSE).
