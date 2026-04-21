# Liminal Actors

**Liminal** is an Effect actor framework optimized for Cloudflare durable objects over hibernatable websocket.

- Client attachments automatically persist across hibernations.
- Effect schemas serve as the source of truth for your actor state, methods and events.
- Effect atoms accumulate state by reducing actor events.
- When a client is routed to an incompatible actor, it fails with a recoverable `AuditionError`.
- `Audition` module simplifies "auditioning" clients until one is successfully upgraded to a matching actor.
- Instrumented with debug logging and OTEL-compatible span tracing.

## Contributing

```
git clone --recurse-submodules=konfik git@github.com:crosshatch/liminal.git
```

To contribute, please read our [contributing guideline](https://github.com/crosshatch/konfik/blob/main/CONTRIBUTING.md).

## License

This library is licensed under [the Apache 2.0 License](https://github.com/crosshatch/konfik/blob/main/LICENSE).
