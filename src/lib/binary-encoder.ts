import BinaryCoderBase from "./binary-coder-base";
import type { BufferWriteBigIntMethod, BufferWriteNumberMethod, Endianness } from "./types";

const _DEFAULT_CHUNK_SIZE = 256;

/** Function that builds an encoder in a dynamic resizing context. */
export type DynamicSizeBuilder = (encoder: BinaryEncoder) => void;

/** Options for the static {@link BinaryEncoder.dynamicallySized} method. */
export interface DynamicSizeBuilderWithOptions {
  /** If provided, the resulting encoder will have at least this many bytes. */
  minimumSize?: number;
  /** Initial offset to use in the encoder (0 by default). */
  initialOffset?: number;
  /** Endianness to use in the encoder (little endian by default). */
  endianness?: Endianness;
  /** Number of bytes to add on overflow (256 by default). */
  chunkSize?: number;
  /** Function that builds the encoder with dynamic resizing. */
  builder: DynamicSizeBuilder;
}

/**
 * Encodes binary data to a buffer.
 */
export default class BinaryEncoder extends BinaryCoderBase {
  //#region Properties

  private _dynamicSizing = false;
  private _dynamicChunkSize = _DEFAULT_CHUNK_SIZE;
  private _dynamicBufferCropSize = 0;
  private _dynamicMinimumCropSize = null;

  //#endregion

  //#region Initialization

  /**
   * Creates a new {@link BinaryEncoder} that can write to the given buffer.
   * 
   * Static initializers are also available:
   * - {@link alloc}: Create a {@link BinaryEncoder} with a byte size, rather
   *   than a buffer.
   * - {@link dynamicallySized}: Create a {@link BinaryEncoder} whose byte size
   *   grows as needed.
   * 
   * @param buffer Buffer to encode.
   * @param initialOffset Initial offset to use (0 by default).
   * @param endianness Endianness to use (little endian by default).
   */
  constructor(
    buffer: Buffer,
    initialOffset: number = 0,
    endianness: Endianness = "LE"
  ) {
    super(buffer, initialOffset, endianness);
  }

  /**
   * Creates a new buffer with the given size and returns a
   * {@link BinaryEncoder} for it.
   * 
   * @param size Size of buffer to encode.
   * @param initialOffset Initial offset to use (0 by default).
   * @param endianness Endianness to use (little endian by default).
   */
  static alloc(
    size: number,
    initialOffset: number = 0,
    endianness: Endianness = "LE"
  ): BinaryEncoder {
    if (!(Number.isInteger(size) && size >= 0))
      throw new RangeError("Encoder size must be a non-negative integer.");
    return new BinaryEncoder(Buffer.alloc(size), initialOffset, endianness);
  }

  /**
   * Creates a {@link BinaryEncoder} whose buffer size will dynamically grow to
   * fit all of the data that is written in the given function. When the
   * function ends, the buffer will be cropped so that it contains the exact
   * amount of bytes required.
   * 
   * **Note**: It is not recommended to use this method when performance is
   * critical, as new buffers may be generated multiple times. For more
   * performant options, see {@link constructor} and {@link alloc}.
   * 
   * @param builder Function to run in a dynamic sizing context.
   * @returns Encoder created with dynamic size.
   */
  static dynamicallySized(builder: DynamicSizeBuilder): BinaryEncoder;
  /**
   * Creates a {@link BinaryEncoder} whose buffer size will dynamically grow to
   * fit all of the data that is written in the given function. When the
   * function ends, the buffer will be cropped so that it contains the exact
   * amount of bytes required.
   * 
   * **Note**: It is not recommended to use this method when performance is
   * critical, as new buffers may be generated multiple times. For more
   * performant options, see {@link constructor} and {@link alloc}.
   * 
   * @param options Configurations for creating the encoder.
   * @returns Encoder created with dynamic size.
   */
  static dynamicallySized(options: DynamicSizeBuilderWithOptions): BinaryEncoder;
  static dynamicallySized(
    builderOrOptions: DynamicSizeBuilder | DynamicSizeBuilderWithOptions
  ): BinaryEncoder {
    const options = typeof builderOrOptions === "function" ? null : builderOrOptions;
    const builder = options?.builder ?? builderOrOptions as DynamicSizeBuilder;
    const offset = options?.initialOffset ?? 0;
    const endianness = options?.endianness ?? "LE";
    const chunkSize = options?.chunkSize ?? _DEFAULT_CHUNK_SIZE;
    // chunkSize will be validated in withDynamicSize()
    const minimumSize = options?.minimumSize ?? 0;
    if (!(Number.isInteger(minimumSize) && minimumSize >= 0))
      throw new RangeError("Minimum size must be a non-negative integer.");
    const initialSize = Math.max(chunkSize, minimumSize);
    const encoder = BinaryEncoder.alloc(initialSize, offset, endianness);
    encoder._dynamicMinimumCropSize = minimumSize;
    encoder.withDynamicSize(chunkSize, () => builder(encoder));
    encoder._dynamicMinimumCropSize = null;
    return encoder;
  }

  //#endregion

  //#region Text / Encoded Bytes

  /**
   * Writes a string to the buffer using the given encoding.
   * 
   * @param value The characters to write.
   * @param encoding Character encoding to write with ("utf-8" by default).
   */
  chars(value: string, encoding: BufferEncoding = "utf-8") {
    const byteLength = Buffer.byteLength(value, encoding);
    this._resizeIfDynamic(byteLength);
    const bytesWritten = this.buffer.write(value, this.offset, byteLength, encoding);
    this._setOffset(this.offset + bytesWritten);
  }

  /**
   * Writes a string to the buffer using the given encoding, then writes a null
   * byte immediately after to terminate it.
   * 
   * @param value The string to write.
   * @param encoding Character encoding to write with ("utf-8" by default).
   */
  terminatedString(value: string, encoding: BufferEncoding = "utf-8") {
    this.chars(value, encoding);
    this.null();
  }

  /**
   * Writes a string to the buffer using UTF-8 encoding.
   * 
   * @deprecated Use {@link chars} instead.
   * @param value The characters to write.
   */
  charsUtf8(value: string) {
    this.chars(value, "utf-8");
  }

  /**
   * Writes a string to the buffer using Base64 encoding.
   * 
   * @deprecated Use {@link chars} instead (use "base64" as second argument).
   * @param value The characters to write.
   */
  charsBase64(value: string) {
    this.chars(value, "base64");
  }

  //#endregion Text / Encoded Bytes

  //#region Raw Bytes / Buffers

  /**
   * Writes a UInt8 value of 1 if the given boolean is true, or 0 if false.
   * 
   * @param value Boolean value to write as a UInt8.
   */
  boolean(value: boolean) {
    this.uint8(value ? 1 : 0);
  }

  /**
   * Writes a single numerical value as a byte (alias for {@link uint8}).
   * 
   * @param value Single byte value to write.
   */
  byte(value: number) {
    this.uint8(value);
  }

  /**
   * Writes an array of bytes to the buffer.
   * 
   * @param values Array of bytes to write.
   */
  bytes(values: number[] | Uint8Array) {
    values.forEach((value: number) => this.byte(value));
  }

  /**
   * Writes the given number of null bytes. If omitted, only one is written.
   * 
   * @param bytes Number of null bytes to write (1 by default).
   */
  null(bytes: number = 1) {
    if (bytes > 0) for (let _ = 0; _ < bytes; ++_) this.uint8(0);
  }

  //#endregion Raw Bytes / Buffers

  //#region Numbers

  private _number(bytes: number, value: number, methodName: BufferWriteNumberMethod) {
    this._resizeIfDynamic(bytes);
    this._setOffset(this.buffer[methodName](value, this.offset));
  }

  private _bigint(value: bigint, methodName: BufferWriteBigIntMethod) {
    this._resizeIfDynamic(8);
    this._setOffset(this.buffer[methodName](value, this.offset));
  }

  /**
   * Writes an 8-bit unsigned integer. Consumes 1 byte.
   * 
   * @param value The UInt8 to write.
   */
  uint8(value: number) {
    this._number(1, value, "writeUInt8");
  }

  /**
   * Writes a 16-bit unsigned integer. Consumes 2 bytes.
   * 
   * @param value The UInt16 to write.
   */
  uint16(value: number) {
    this._number(
      2,
      value,
      this._resolveEndian("writeUInt16LE", "writeUInt16BE")
    );
  }

  /**
   * Writes a 32-bit unsigned integer. Consumes 4 bytes.
   * 
   * @param value The UInt32 to write.
   */
  uint32(value: number) {
    this._number(
      4,
      value,
      this._resolveEndian("writeUInt32LE", "writeUInt32BE")
    );
  }

  /**
   * Writes a 64-bit unsigned integer. Consumes 8 bytes.
   * 
   * @param value The UInt64 to write.
   */
  uint64(value: number | bigint) {
    this._bigint(
      BigInt(value),
      this._resolveEndian("writeBigUInt64LE", "writeBigUInt64BE")
    );
  }

  /**
   * Writes an 8-bit signed integer. Consumes 1 byte.
   * 
   * @param value The Int8 to write.
   */
  int8(value: number) {
    this._number(1, value, "writeInt8");
  }

  /**
   * Writes a 16-bit signed integer. Consumes 2 bytes.
   * 
   * @param value The Int16 to write.
   */
  int16(value: number) {
    this._number(
      2,
      value,
      this._resolveEndian("writeInt16LE", "writeInt16BE")
    );
  }

  /**
   * Writes a 32-bit signed integer. Consumes 4 bytes.
   * 
   * @param value The Int32 to write.
   */
  int32(value: number) {
    this._number(
      4,
      value,
      this._resolveEndian("writeInt32LE", "writeInt32BE")
    );
  }

  /**
   * Writes a 64-bit signed integer. Consumes 8 bytes.
   * 
   * @param value The Int64 to write.
   */
  int64(value: number | bigint) {
    this._bigint(
      BigInt(value),
      this._resolveEndian("writeBigInt64LE", "writeBigInt64BE")
    );
  }

  /**
   * Writes a float. Consumes 4 bytes.
   * 
   * @param value The float to write.
   */
  float(value: number) {
    this._number(
      4,
      value,
      this._resolveEndian("writeFloatLE", "writeFloatBE")
    );
  }

  /**
   * Writes a double. Consumes 8 bytes.
   * 
   * @param value The double to write.
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

  // TODO: method to increase size by n bytes

  // TODO: method to increase size for clearance

  /**
   * Runs a function in which the encoder's size will dynamically grow in order
   * to accomodate all of the data that is written. When the function ends, the
   * buffer will be cropped so that it contains the exact amount of bytes
   * required (Note: it will never crop bytes that existed before this function
   * was called, even if they are empty).
   * 
   * @param fn Function to run in a dynamic sizing context.
   */
  withDynamicSize(fn: () => void): void;
  /**
   * Runs a function in which the encoder's size will dynamically grow in order
   * to accomodate all of the data that is written. When the function ends, the
   * buffer will be cropped so that it contains the exact amount of bytes
   * required (Note: it will never crop bytes that existed before this function
   * was called, even if they are empty).
   * 
   * @param chunkSize Number of bytes to add on overflow (256 by default).
   * @param fn Function to run in a dynamic sizing context.
   */
  withDynamicSize(chunkSize: number, fn: () => void): void;
  withDynamicSize(fnOrChunkSize: number | (() => void), possibleFn?: () => void) {
    if (this._dynamicSizing)
      throw new Error("Recursive calls to enable dynamic sizing are not allowed.");
    const fn = possibleFn ?? fnOrChunkSize as () => void;
    const chunkSize = possibleFn ? fnOrChunkSize as number : _DEFAULT_CHUNK_SIZE;
    if (!(Number.isInteger(chunkSize) && chunkSize > 0))
      throw new RangeError("Chunk size must be a positive integer.");
    this._dynamicSizing = true;
    this._dynamicChunkSize = chunkSize;
    this._dynamicBufferCropSize = this._dynamicMinimumCropSize ?? this.byteLength;
    fn();
    this._dynamicSizing = false;
    this._dynamicChunkSize = _DEFAULT_CHUNK_SIZE;
    if (this._dynamicBufferCropSize < this.byteLength)
      this._cropBuffer(this._dynamicBufferCropSize);
    this._dynamicBufferCropSize = 0;
    if (this.offset > this.byteLength)
      this._setOffset(this.byteLength);
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
