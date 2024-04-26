import BinaryCoderBase from "./binary-coder-base";
import type { BufferWriteBigIntMethod, BufferWriteNumberMethod, Endianness } from "./types";

const _DEFAULT_CHUNK_SIZE = 256;

/** Function that builds an encoder in a dynamic resizing context. */
type DynamicSizeBuilder = (encoder: BinaryEncoder) => void;

/** Options for static `BinaryEncoder.withDynamicSize()` method. */
interface DynamicSizeBuilderWithOptions {
  /** Initial size to use in new BinaryEncoder (chunkSize by default) */
  initialSize?: number;
  /** Initial offset to use in new BinaryEncoder (0 by default) */
  initialOffset?: number;
  /** Endianness to use in new BinaryEncoder (little endian by default) */
  endianness?: Endianness;
  /** Number of bytes to add on overflow (256 by default) */
  chunkSize?: number;
  /** Function that builds the new BinaryEncoder with dynamic resizing */
  builder: DynamicSizeBuilder;
}

/**
 * A class for encoding binary files. The encoder keeps track of an offset,
 * which is incremented every time a value is written.
 */
export default class BinaryEncoder extends BinaryCoderBase {
  //#region Properties

  private _dynamicSizing = false;
  private _dynamicChunkSize = _DEFAULT_CHUNK_SIZE;
  private _dynamicBufferCropSize = 0;

  //#endregion

  //#region Initialization

  /**
   * Creates a new BinaryEncoder that can write to the given buffer.
   * 
   * @param buffer Buffer to encode
   * @param initialOffset Initial offset to use (0 by default)
   * @param endianness Endianness to use (little endian by default)
   */
  constructor(
    buffer: Buffer,
    initialOffset: number = 0,
    endianness: Endianness = "LE"
  ) {
    super(buffer, initialOffset, endianness);
  }

  /**
   * Creates a new buffer and returns an encoder for it.
   * 
   * @param size Size of buffer to encode
   * @param initialOffset Initial offset to use. 0 by default.
   * @param endianness Endianness to use(little endian by default)
   */
  static alloc(
    size: number,
    initialOffset: number = 0,
    endianness: Endianness = "LE"
  ): BinaryEncoder {
    return new BinaryEncoder(Buffer.alloc(size), initialOffset, endianness);
  }

  /**
   * Creates a new BinaryEncoder whose size will dynamically grow to fit all of
   * the data that is written in the given function.
   * 
   * When the function ends, the buffer will be cropped so that it contains the
   * exact amount of bytes required.
   * 
   * @param builder Function to run in a dynamic sizing context
   * @returns New BinaryEncoder created with dynamic size
   */
  static withDynamicSize(builder: DynamicSizeBuilder): BinaryEncoder;
  /**
   * Creates a new BinaryEncoder whose size will dynamically grow to fit all of
   * the data that is written in the given function.
   * 
   * When the function ends, the buffer will be cropped so that it contains the
   * exact amount of bytes required.
   * 
   * @param options Configurations for creating the new BinaryEncoder
   * @returns New BinaryEncoder created with dynamic size
   */
  static withDynamicSize(options: DynamicSizeBuilderWithOptions): BinaryEncoder;
  static withDynamicSize(
    builderOrOptions: DynamicSizeBuilder | DynamicSizeBuilderWithOptions
  ): BinaryEncoder {
    const options = typeof builderOrOptions === "function" ? null : builderOrOptions;
    const offset = options?.initialOffset ?? 0;
    const endianness = options?.endianness ?? "LE";
    const chunkSize = options?.chunkSize ?? _DEFAULT_CHUNK_SIZE;
    const initialSize = options?.initialSize ?? chunkSize;
    const builder = options?.builder ?? builderOrOptions as DynamicSizeBuilder;
    const encoder = BinaryEncoder.alloc(initialSize, offset, endianness);
    encoder.withDynamicSize(chunkSize, () => builder(encoder));
    return encoder;
  }

  //#endregion

  //#region Text / Encoded Bytes

  /**
   * Writes a string to the buffer using the given encoding.
   * 
   * @param value The characters to write
   * @param encoding Character encoding to write with ("utf-8" by default)
   */
  chars(value: string, encoding: BufferEncoding = "utf-8") {
    const byteLength = Buffer.byteLength(value, encoding);
    this._resizeIfDynamic(byteLength);
    // intentionally += because write() returns # bytes written
    this.offset += this.buffer.write(value, this.offset, byteLength, encoding);
  }

  /**
   * Writes a string to the buffer using the given encoding, then writes a null
   * byte immediately after to terminate it.
   * 
   * @param value The string to write
   * @param encoding Character encoding to write with ("utf-8" by default)
   */
  terminatedString(value: string, encoding: BufferEncoding = "utf-8") {
    this.chars(value, encoding);
    this.null();
  }

  /**
   * Writes a string to the buffer using UTF-8 encoding.
   * 
   * @deprecated Use `chars()` instead
   * @param value The characters to write
   */
  charsUtf8(value: string) {
    this.chars(value, "utf-8");
  }

  /**
   * Writes a string to the buffer using Base64 encoding.
   * 
   * @deprecated Use `chars()` instead (add "base64" as second argument)
   * @param value The characters to write
   */
  charsBase64(value: string) {
    this.chars(value, "base64");
  }

  //#endregion Text / Encoded Bytes

  //#region Raw Bytes / Buffers

  /**
   * Writes a UInt8 value of 1 if the given boolean is true, or 0 if it is false.
   * 
   * @param value Boolean value to write as a UInt8
   */
  boolean(value: boolean) {
    this.uint8(value ? 1 : 0);
  }

  /**
   * Writes a single numerical value as a byte. This is an alias for `uint8()`.
   * 
   * @param value Single byte value to write
   */
  byte(value: number) {
    this.uint8(value);
  }

  /**
   * Writes an array of bytes to the buffer.
   * 
   * @param values Array of bytes to write
   */
  bytes(values: number[] | Uint8Array) {
    values.forEach((value: number) => this.byte(value));
  }

  /**
   * Writes the given number of null bytes. If omitted, only one is written.
   * 
   * @param bytes Number of null bytes to write
   */
  null(bytes: number = 1) {
    if (bytes > 0) for (let _ = 0; _ < bytes; ++_) this.uint8(0);
  }

  //#endregion Raw Bytes / Buffers

  //#region Numbers

  /**
   * Writes a number to the buffer using the given method.
   * 
   * @param value The number to write
   * @param methodName The method to write the number with
   */
  private _number(bytes: number, value: number, methodName: BufferWriteNumberMethod) {
    this._resizeIfDynamic(bytes);
    // intentionally = because all number methods return current offset + # bytes written
    this.offset = this.buffer[methodName](value, this.offset);
  }

  /**
   * Writes a bigint to the buffer using the given method.
   * 
   * @param value The bigint to write
   * @param methodName The method to write the bigint with
   */
  private _bigint(value: bigint, methodName: BufferWriteBigIntMethod) {
    this._resizeIfDynamic(8);
    // intentionally = because all number methods return current offset + # bytes written
    this.offset = this.buffer[methodName](value, this.offset);
  }

  /**
   * Writes an 8-bit unsigned integer to the buffer.
   * 
   * @param value The uint8 to write
   */
  uint8(value: number) {
    this._number(1, value, "writeUInt8");
  }

  /**
   * Writes a 16-bit unsigned integer to the buffer.
   * 
   * @param value The uint16 to write
   */
  uint16(value: number) {
    this._number(
      2,
      value,
      this._resolveEndian("writeUInt16LE", "writeUInt16BE")
    );
  }

  /**
   * Writes a 32-bit unsigned integer to the buffer.
   * 
   * @param value The uint32 to write
   */
  uint32(value: number) {
    this._number(
      4,
      value,
      this._resolveEndian("writeUInt32LE", "writeUInt32BE")
    );
  }

  /**
   * Writes a 64-bit unsigned integer to the buffer.
   * 
   * @param value The uint64 to write
   */
  uint64(value: number | bigint) {
    this._bigint(
      BigInt(value),
      this._resolveEndian("writeBigUInt64LE", "writeBigUInt64BE")
    );
  }

  /**
   * Writes an 8-bit signed integer to the buffer.
   * 
   * @param value The int8 to write
   */
  int8(value: number) {
    this._number(1, value, "writeInt8");
  }

  /**
   * Writes a 16-bit signed integer to the buffer.
   * 
   * @param value The int16 to write
   */
  int16(value: number) {
    this._number(
      2,
      value,
      this._resolveEndian("writeInt16LE", "writeInt16BE")
    );
  }

  /**
   * Writes a 32-bit signed integer to the buffer.
   * 
   * @param value The int32 to write
   */
  int32(value: number) {
    this._number(
      4,
      value,
      this._resolveEndian("writeInt32LE", "writeInt32BE")
    );
  }

  /**
   * Writes a 64-bit signed integer to the buffer.
   * 
   * @param value The int64 to write
   */
  int64(value: number | bigint) {
    this._bigint(
      BigInt(value),
      this._resolveEndian("writeBigInt64LE", "writeBigInt64BE")
    );
  }

  /**
   * Writes a float to the buffer.
   * 
   * @param value The float to write
   */
  float(value: number) {
    this._number(
      4,
      value,
      this._resolveEndian("writeFloatLE", "writeFloatBE")
    );
  }

  /**
   * Writes a double to the buffer.
   * 
   * @param value The double to write
   */
  double(value: number) {
    this._number(
      8,
      value,
      this._resolveEndian("writeDoubleLE", "writeDoubleBE")
    );
  }

  //#endregion Numbers

  //#region Dynamic Sizing

  /**
   * Runs a function in which the encoder's size will dynamically grow in order
   * to accomodate all of the data that is written.
   * 
   * When the function ends, the buffer will be cropped so that it contains the
   * exact amount of bytes required.
   * 
   * @param fn Function to run in a dynamic sizing context
   */
  withDynamicSize(fn: () => void): void;
  /**
   * Runs a function in which the encoder's size will dynamically grow in order
   * to accomodate all of the data that is written.
   * 
   * When the function ends, the buffer will be cropped so that it contains the
   * exact amount of bytes required.
   * 
   * @param chunkSize Number of bytes to add on overflow (256 by default)
   * @param fn Function to run in a dynamic sizing context
   */
  withDynamicSize(chunkSize: number, fn: () => void): void;
  withDynamicSize(fnOrChunkSize: number | (() => void), possibleFn?: () => void) {
    if (this._dynamicSizing)
      throw new Error("Recursive calls to enable dynamic sizing are not allowed.");
    const fn = possibleFn ?? fnOrChunkSize as () => void;
    const chunkSize = possibleFn ? fnOrChunkSize as number : _DEFAULT_CHUNK_SIZE;
    if (!(Number.isInteger(chunkSize) && chunkSize > 0))
      throw new Error("Chunk size must be a positive integer.");
    this._dynamicSizing = true;
    this._dynamicChunkSize = chunkSize;
    this._dynamicBufferCropSize = this.byteLength;
    fn();
    this._dynamicSizing = false;
    this._dynamicChunkSize = _DEFAULT_CHUNK_SIZE;
    if (this._dynamicBufferCropSize < this.byteLength)
      this._cropBuffer(this._dynamicBufferCropSize);
    this._dynamicBufferCropSize = 0;
  }

  private _resizeIfDynamic(bytes: number) {
    if (!this._dynamicSizing) return;
    const writeEnd = this.offset + bytes;
    if (writeEnd > this._dynamicBufferCropSize)
      this._dynamicBufferCropSize = writeEnd;
    if (this.hasClearance(bytes)) return;
    let bytesToAdd = 0;
    do { bytesToAdd += this._dynamicChunkSize; }
    while (this.offset + bytes > this.byteLength + bytesToAdd);
    this._addBytesToBuffer(bytesToAdd);
  }

  //#endregion
}
