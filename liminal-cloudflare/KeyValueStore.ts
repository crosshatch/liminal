export {}

// import { Effect, Layer } from "effect"
// import { KeyValueStore } from "effect/unstable/persistence/KeyValueStore"

// export const layerR2 = (r2: R2Bucket) =>
//   Layer.succeed(
//     KeyValueStore,
//     KeyValueStore.of({
//       "~effect/persistence/KeyValueStore": "~effect/persistence/KeyValueStore",
//       /**
//        * Returns the value of the specified key if it exists.
//        */
//       // readonly get: (key: string) => Effect.Effect<string | undefined, KeyValueStoreError>
//       get: Effect.fnUntraced(function* (key) {}),

//       /**
//        * Returns the value of the specified key if it exists.
//        */
//       // readonly getUint8Array: (key: string) => Effect.Effect<Uint8Array | undefined, KeyValueStoreError>
//       getUint8Array: Effect.fnUntraced(function* (key) {}),

//       /**
//        * Sets the value of the specified key.
//        */
//       // readonly set: (key: string, value: string | Uint8Array) => Effect.Effect<void, KeyValueStoreError>
//       set: Effect.fnUntraced(function* (key, value) {}),

//       /**
//        * Removes the specified key.
//        */
//       // readonly remove: (key: string) => Effect.Effect<void, KeyValueStoreError>
//       remove: Effect.fnUntraced(function* (key) {}),

//       /**
//        * Removes all entries.
//        */
//       // readonly clear: Effect.Effect<void, KeyValueStoreError>
//       clear: Effect.gen(function* () {}),

//       /**
//        * Returns the number of entries.
//        */
//       // readonly size: Effect.Effect<number, KeyValueStoreError>
//       size: Effect.gen(function* () {}),

//       /**
//        * Updates the value of the specified key if it exists.
//        */
//       // readonly modify: (
//       //   key: string,
//       //   f: (value: string) => string
//       // ) => Effect.Effect<string | undefined, KeyValueStoreError>
//       modify: Effect.fnUntraced(function* (key, f) {}),

//       /**
//        * Updates the value of the specified key if it exists.
//        */
//       // readonly modifyUint8Array: (
//       //   key: string,
//       //   f: (value: Uint8Array) => Uint8Array
//       // ) => Effect.Effect<Uint8Array | undefined, KeyValueStoreError>
//       modifyUint8Array: Effect.fnUntraced(function* (key, f) {}),

//       /**
//        * Returns true if the KeyValueStore contains the specified key.
//        */
//       // readonly has: (key: string) => Effect.Effect<boolean, KeyValueStoreError>
//       has: Effect.fnUntraced(function* (key) {}),

//       /**
//        * Checks if the KeyValueStore contains any entries.
//        */
//       // readonly isEmpty: Effect.Effect<boolean, KeyValueStoreError>
//       isEmpty: Effect.gen(function* () {}),
//     }),
//   )
