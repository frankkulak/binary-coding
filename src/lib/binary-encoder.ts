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
   * @throws If size is not a non-negative integer.
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
   * **Notes**
   * - New buffers may be generated multiple times; references to them are
   *   unreliable.
   * - When performance is critical, it is recommended to use {@link alloc} or
   *   {@link constructor} with a pre-calculated size instead.
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
   * **Notes**
   * - New buffers may be generated multiple times; references to them are
   *   unreliable.
   * - When performance is critical, it is recommended to use {@link alloc} or
   *   {@link constructor} with a pre-calculated size instead.
   * 
   * @param options Configurations for creating the encoder.
   * @returns Encoder created with dynamic size.
   * @throws If `minimumSize` is not a non-negative integer or `chunkSize` is
   * not a positive integer.
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
   * @throws If buffer cannot fit number of specified byte(s).
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
   * @throws If buffer cannot fit number of specified byte(s).
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
   * @throws If buffer cannot fit number of specified byte(s).
   */
  charsUtf8(value: string) {
    this.chars(value, "utf-8");
  }

  /**
   * Writes a string to the buffer using Base64 encoding.
   * 
   * @deprecated Use {@link chars} instead (use "base64" as second argument).
   * @param value The characters to write.
   * @throws If buffer cannot fit number of specified byte(s).
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
   * @throws If buffer cannot fit 1 more byte.
   */
  boolean(value: boolean) {
    this.uint8(value ? 1 : 0);
  }

  /**
   * Writes a single numerical value as a byte (alias for {@link uint8}).
   * 
   * @param value Single byte value to write.
   * @throws If buffer cannot fit 1 more byte.
   */
  byte(value: number) {
    this.uint8(value);
  }

  /**
   * Writes an array of bytes to the buffer.
   * 
   * @param values Array of bytes to write.
   * @throws If buffer cannot fit number of specified byte(s).
   */
  bytes(values: number[] | Uint8Array) {
    values.forEach((value: number) => this.byte(value));
  }

  /**
   * Writes the given number of null bytes. If omitted, only one is written.
   * 
   * @param bytes Number of null bytes to write (1 by default).
   * @throws If buffer cannot fit number of specified byte(s).
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
   * @throws If buffer cannot fit 1 more byte.
   */
  uint8(value: number) {
    this._number(1, value, "writeUInt8");
  }

  /**
   * Writes a 16-bit unsigned integer. Consumes 2 bytes.
   * 
   * @param value The UInt16 to write.
   * @throws If buffer cannot fit 2 more bytes.
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
   * @throws If buffer cannot fit 4 more bytes.
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
   * @throws If buffer cannot fit 8 more bytes.
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
   * @throws If buffer cannot fit 1 more byte.
   */
  int8(value: number) {
    this._number(1, value, "writeInt8");
  }

  /**
   * Writes a 16-bit signed integer. Consumes 2 bytes.
   * 
   * @param value The Int16 to write.
   * @throws If buffer cannot fit 2 more bytes.
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
   * @throws If buffer cannot fit 4 more bytes.
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
   * @throws If buffer cannot fit 8 more bytes.
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
   * @throws If buffer cannot fit 4 more bytes.
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
   * @throws If buffer cannot fit 8 more bytes.
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
   * Checks whether this encoder can safely consume the given number of bytes
   * from the given offset (or the current offset if omitted), and if not,
   * increases the size of the buffer by just enough to do so.
   * 
   * **Notes**
   * - A new buffer may be generated; references to it will be unreliable.
   * - When performance is critical, you should precalculate the entire size of
   *   the buffer at time of initialization.
   * 
   * @param bytes Number of bytes to check.
   * @param fromOffset Offset to check from, if different than current one.
   * @returns Number of bytes that were added, if any.
   * @throws If offset is negative (cannot add bytes to start).
   */
  ensureClearance(bytes: number, fromOffset?: number): number {
    const offset = fromOffset ?? this.offset;
    if (offset < 0) throw new RangeError("Cannot add bytes to start of buffer.");
    const clearance = this.byteLength - offset;
    if (bytes <= clearance) return 0;
    const bytesToAdd = bytes - clearance;
    this._addBytesToBuffer(bytesToAdd);
    return bytesToAdd;
  }

  /**
   * Increases the size of the buffer by the given number of bytes.
   * 
   * **Notes**
   * - A new buffer will be generated; references to it will be broken.
   * - When performance is critical, you should precalculate the entire size of
   *   the buffer at time of initialization.
   * 
   * @param bytes Bytes to increase buffer size by.
   * @throws If `bytes` is not a positive integer.
   */
  increaseSize(bytes: number) {
    if (!(Number.isInteger(bytes) && bytes > 0))
      throw new RangeError("Can only increase size by a positive integer.");
    this._addBytesToBuffer(bytes);
  }

  /**
   * Runs a function in which the encoder's size can dynamically grow to fit the
   * data written. When the function ends, any unused bytes that did not exist
   * before calling this function will be pruned.
   * 
   * **Notes**
   * - New buffers may be generated multiple times; references to them are
   *   unreliable.
   * - When performance is critical, you should precalculate the entire size of
   *   the buffer at time of initialization.
   * 
   * @param fn Function to run in a dynamic sizing context.
   */
  withDynamicSize(fn: () => void): void;
  /**
   * Runs a function in which the encoder's size can dynamically grow to fit the
   * data written. When the function ends, any unused bytes that did not exist
   * before calling this function will be pruned.
   * 
   * **Notes**
   * - New buffers may be generated multiple times; references to them are
   *   unreliable.
   * - When performance is critical, you should precalculate the entire size of
   *   the buffer at time of initialization.
   * 
   * @param chunkSize Number of bytes to add on overflow (256 by default).
   * @param fn Function to run in a dynamic sizing context.
   * @throws If `chunkSize` is not a positive integer.
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
