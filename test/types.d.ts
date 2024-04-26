import type { BinaryEncoder, BinaryDecoder, Endianness } from "../dst/index";

type MethodNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

type BinaryCoder = BinaryEncoder | BinaryDecoder

export interface NumberMethodArgs<T extends BinaryCoder> {
  name: MethodNames<T>;
  bytes: number;
  methodLE: MethodNames<Buffer>;
  methodBE: MethodNames<Buffer>;
  value: number | bigint;
  floatEquality?: boolean;
  isSigned?: boolean;
}

export interface BinaryCoderMethodArgs {
  createCoder: (size: number, offset?: number, endianness?: Endianness) => BinaryCoder;
}
