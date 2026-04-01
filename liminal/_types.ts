import { Schema as S } from "effect"

export type SchemaAll = S.Schema<any, any> | S.Schema<any, never> | S.Schema<never, any> | S.Schema<never, never>

export type PropertySignatureAll<Key extends PropertyKey = PropertyKey> =
  | S.PropertySignature<S.PropertySignature.Token, any, Key, S.PropertySignature.Token, any, boolean>
  | S.PropertySignature<S.PropertySignature.Token, never, Key, S.PropertySignature.Token, any, boolean>
  | S.PropertySignature<S.PropertySignature.Token, any, Key, S.PropertySignature.Token, never, boolean>
  | S.PropertySignature<S.PropertySignature.Token, never, Key, S.PropertySignature.Token, never, boolean>

export type Field = SchemaAll | PropertySignatureAll

export type Fields = { readonly [x: keyof any]: Field }

export type FieldsRecord = Record<string, Fields>

export declare namespace FieldsRecord {
  export namespace TaggedMember {
    export type Type<T extends FieldsRecord, K extends keyof T = keyof T> = {
      [K_ in K]: { readonly _tag: K_ } & S.Struct<T[K_]>["Type"]
    }[K]

    export type Encoded<T extends FieldsRecord, K extends keyof T = keyof T> = {
      [K_ in K]: { readonly _tag: K_ } & S.Struct<T[K_]>["Encoded"]
    }[K]
  }
}
