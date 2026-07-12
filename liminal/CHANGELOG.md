# liminal

## 0.17.18

### Patch Changes

- Updated dependencies
  [[`2ecb27b`](https://github.com/crosshatch/liminal/commit/2ecb27b1cef66930a747b0532dfa07b21356b2e1)]:
  - liminal-util@0.0.12
  - effect-workerd@0.0.8

## 0.17.17

### Patch Changes

- [#465](https://github.com/crosshatch/liminal/pull/465)
  [`6920795`](https://github.com/crosshatch/liminal/commit/692079548446a9d4274d5a9a4ae4039b3ab3dc91)
  Thanks @harrysolovay! - Continue debugging trusted / CI publishing.

- [#465](https://github.com/crosshatch/liminal/pull/465)
  [`6920795`](https://github.com/crosshatch/liminal/commit/692079548446a9d4274d5a9a4ae4039b3ab3dc91)
  Thanks @harrysolovay! - Continue testing changesets configuration tweaks.

- Updated dependencies
  [[`b64dcce`](https://github.com/crosshatch/liminal/commit/b64dcce3009984771205d5c31f7f7e14508b2757),
  [`6920795`](https://github.com/crosshatch/liminal/commit/692079548446a9d4274d5a9a4ae4039b3ab3dc91),
  [`6920795`](https://github.com/crosshatch/liminal/commit/692079548446a9d4274d5a9a4ae4039b3ab3dc91)]:
  - liminal-util@0.0.11
  - effect-workerd@0.0.7

## 0.17.16

### Patch Changes

- b08b6d9: Begin trusted publishing configuration.
- Updated dependencies [b08b6d9]
  - effect-workerd@0.0.6
  - liminal-util@0.0.10

## 0.17.15

### Patch Changes

- ab30d60: Move accumulator api directly into client and implement internal
  actor method bindings.
- Updated dependencies [ab30d60]
  - effect-workerd@0.0.5

## 0.17.14

### Patch Changes

- d082441: Actor now inherits from DurableObject. Effect updated to beta 57.
- Updated dependencies [d082441]
  - effect-workerd@0.0.4

## 0.17.13

### Patch Changes

- 6a6fe05: Debug publish of liminal-util.
- Updated dependencies [6a6fe05]
  - liminal-util@0.0.9
  - effect-workerd@0.0.3

## 0.17.12

### Patch Changes

- a00b8aa: Move workerd-specifics into dedicated package.
- Updated dependencies [a00b8aa]
  - effect-workerd@0.0.2
  - liminal-util@0.0.2

## 0.17.11

### Patch Changes

- 01eb088: Move everything cloudflare-related directly into liminal.

## 0.17.10

### Patch Changes

- 9583d0e: Rework the module structure for bindings.

## 0.17.9

### Patch Changes

- 2c5c785: Simplify API for client event emission and disconnection. Move
  binding specificity to layer provision step.

## 0.17.8

### Patch Changes

- 5c2a730: Move cloudflare bindings into subdir in preparation for extraction
  into different package."

## 0.17.7

### Patch Changes

- e5c54be: Decouple actor transport. Implement proper multi-actor instance
  browser registry.

## 0.17.6

### Patch Changes

- d7b1da3: Simplify type-level representation of client protocol.

## 0.17.5

### Patch Changes

- 7a05f2b: Improve built-in logging. Add AI resource. Resolve issue in which
  client listener suspense propagated suspense to streams and calls.

## 0.17.4

### Patch Changes

- 566bb30: Fix json transcoding. Implement R2-based Effect KV layer.

## 0.17.3

### Patch Changes

- 2d7b56d: Fix broken event encoding.

## 0.17.2

### Patch Changes

- 366c080: Migrate to Effect v4.

## 0.17.1

### Patch Changes

- 17342eb: This version marks a complete reimagining of Liminal. More
  information coming soon.
