import { Data, Context, Pipeable, Function, Effect } from "effect"

import * as Binding from "./Binding.ts"

export class Images extends Context.Service<Images, globalThis.ImagesBinding>()("liminal/ImageTransformer") {}

export const layer = Binding.layer(Images, ["transform", "draw", "output"])

const TypeId = "~liminal/Images/Transformation" as const

export interface Steps extends Pipeable.Pipeable {
  readonly [TypeId]: typeof TypeId
  readonly steps: ReadonlyArray<Step>
}

export interface DrawOptions {
  image: ReadableStream<Uint8Array> | ImageTransformer
  options?: ImageDrawOptions | undefined
}

export type Step = Data.TaggedEnum<{
  Transform: {
    transform: ImageTransform
  }
  Draw: DrawOptions
}>

export const empty: Steps = {
  [TypeId]: TypeId,
  steps: [],
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
}

export const transform: {
  (transform: ImageTransform): (steps: Steps) => Steps
  (steps: Steps, transform: ImageTransform): Steps
} = Function.dual(2, (steps: Steps, transform: ImageTransform) => ({
  [TypeId]: TypeId,
  steps: [
    ...steps.steps,
    {
      _tag: "Transform",
      transform,
    },
  ],
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
}))

export const draw: {
  (draw: DrawOptions): (steps: Steps) => Steps
  (steps: Steps, draw: DrawOptions): Steps
} = Function.dual(2, (steps: Steps, draw: DrawOptions) => ({
  [TypeId]: TypeId,
  steps: [
    ...steps.steps,
    {
      _tag: "Draw",
      ...draw,
    },
  ],
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
}))

export interface ProcessConfig {
  readonly stream: ReadableStream<Uint8Array>
  readonly inputOptions?: ImageInputOptions | undefined
  readonly outputOptions: ImageOutputOptions
}

export const process: {
  (config: ProcessConfig): (steps: Steps) => Effect.Effect<ImageTransformationResult, never, Images>
  (steps: Steps, config: ProcessConfig): Effect.Effect<ImageTransformationResult, never, Images>
} = Function.dual(
  2,
  Effect.fnUntraced(function* ({ steps }: Steps, { stream, inputOptions, outputOptions }: ProcessConfig) {
    const images = yield* Images
    let transformer = images.input(stream, inputOptions)
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!
      switch (step._tag) {
        case "Draw": {
          const { image, options } = step
          transformer = transformer.draw(image, options)
          break
        }
        case "Transform": {
          const { transform } = step
          transformer = transformer.transform(transform)
          break
        }
      }
    }
    return yield* Effect.promise(() => transformer.output(outputOptions))
  }),
)
