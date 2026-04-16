# Liminal Actors

**Liminal** is an Effect actor framework optimized for Cloudflare durable objects over hibernatable websocket.

- Client attachments automatically persist across hibernations.
- Effect schemas serve as the source of truth for your actor state, methods and events.
- Effect atoms accumulate state by reducing actor events.
- When a client is routed to an incompatible actor, it fails with a recoverable `AuditionError`. This enables graceful
  client fallback (single-hop actor polymorphism).
- Liminal is instrumented with debug logging and OTEL-compatible span tracing.

## Contributing

To contribute, please read our [contributing guideline](https://github.com/crosshatch/konfik/blob/main/CONTRIBUTING.md).

## License

This library is licensed under [the Apache 2.0 License](https://github.com/crosshatch/konfik/blob/main/LICENSE).
