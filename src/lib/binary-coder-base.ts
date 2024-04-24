import type BinaryDecoder from "./binary-decoder";
import type BinaryEncoder from "./binary-encoder";
import { EndianResolvableType, Endianness } from "./types";

//#region Circular Dependency Workaround

let DECODER_CLS: typeof BinaryDecoder;
let ENCODER_CLS: typeof BinaryEncoder;
export function setImplementations(impls: {
  decoderCls: typeof BinaryDecoder,
  encoderCls: typeof BinaryEncoder,
}) {
  DECODER_CLS = impls.decoderCls;
  ENCODER_CLS = impls.encoderCls;
}

//#endregion

/**
 * Base class for classes that encode/decode binary files.
 */
export default abstract class BinaryCoderBase {
  //#region Properties

  /** Buffer being read/written. */
  public readonly buffer: Buffer;
  protected _endianness: Endianness;
  protected _offset: number;

  /** Total byte length of buffer. */
  get byteLength(): number { return this.buffer.length; }
  /** Number of bytes between current offset and end of buffer. */
  get bytesRemaining(): number { return this.byteLength - this.offset; }
  /** Endianness currently being used to read/write data. */
  get endianness(): Endianness { return this._endianness; }
  /** Whether current offset is out of the buffer's bounds. */
  get isOutOfBounds(): boolean { return this.offset < 0 || this.offset >= this.byteLength; }
  /** Offset where data is currently being read/written. */
  get offset(): number { return this._offset; }

  //#endregion

  //#region Initialization

  /**
   * @param buffer Buffer to read/write
   * @param initialOffset Initial offset to use (0 by default)
   * @param endianness Endianness to use (little endian by default)
   */
  protected constructor(
    buffer: Buffer,
    initialOffset: number = 0,
    endianness: Endianness = "LE"
  ) {
    this.buffer = buffer;
    this._offset = initialOffset;
    this._endianness = endianness;
  }

  //#endregion

  //#region Methods

  /**
   * Returns a new BinaryDecoder using this coder's buffer.
   * 
   * @param initialOffset Initial offset to use (0 by default)
   * @param endianness Endianness to use (little endian by default)
   * @returns New BinaryDecoder for this coder's buffer
   */
  getDecoder(initialOffset: number = 0, endianness: Endianness = "LE"): BinaryDecoder {
    return new DECODER_CLS(this.buffer, initialOffset, endianness);
  }

  /**
   * Returns a new BinaryEncoder using this coder's buffer.
   * 
   * @param initialOffset Initial offset to use (0 by default)
   * @param endianness Endianness to use (little endian by default)
   * @returns New BinaryEncoder for this coder's buffer
   */
  getEncoder(initialOffset: number = 0, endianness: Endianness = "LE"): BinaryEncoder {
    return new ENCODER_CLS(this.buffer, initialOffset, endianness);
  }

  /**
   * Returns whether this coder can safely consume the given number of bytes,
   * either from a specified offset if `fromOffset` is provided, or from the
   * current offset if it is omitted.
   * 
   * @param bytes Number of bytes to check
   * @param fromOffset Offset to check from, if different than current one
   * @returns True if these bytes can be safely consumed, false otherwise
   */
  hasClearance(bytes: number, fromOffset?: number): boolean {
    const offset = fromOffset ?? this.offset;
    if (offset < 0 || offset >= this.byteLength) return false;
    return bytes <= this.byteLength - offset;
  }

  /**
   * Calls the given function `n` times, appending its result to a list after
   * each iteration, and returning the resulting list.
   * 
   * @param n Number of iterations / length of resulting list
   * @param fn Function to call on each iteration / to populate each list item
   * @returns List containing the results of calling `fn()` `n` times
   */
  iterate<T>(n: number, fn: (i: number) => T): T[] {
    if (n < 0) throw new Error(`Cannot iterate less than 0 times.`);
    const list: T[] = [];
    for (let i = 0; i < n; ++i) list.push(fn(i));
    return list;
  }

  /**
   * Saves the value of the current endianness, runs the given function, and
   * then restores the endianness to the initial saved value.
   * 
   * @param fn Function to call
   * @returns Result of the given function call
   */
  saveEndianness<T>(fn: () => T): T {
    const endianness = this.endianness;
    const result = fn();
    this._endianness = endianness;
    return result;
  }

  /**
   * Saves the value of the current offset, runs the given function, and then
   * restores the offset to the initial saved value.
   * 
   * @param fn Function to call
   * @returns Result of the given function call
   */
  saveOffset<T>(fn: () => T): T {
    const offset = this.offset;
    const result = fn();
    this._offset = offset;
    return result;
  }

  /**
   * Moves the offset to a specific byte.
   * 
   * @param offset The value to set the offset to
   */
  seek(offset: number): void;
  /**
   * Moves the offset to a specific byte.
   * 
   * @deprecated Passing bigints is no longer supported
   * @param offset The value to set the offset to
   */
  seek(offset: bigint): void;
  seek(offset: number | bigint) {
    this._offset = Number(offset);
  }

  /**
   * Sets the endianness to use for reading/writing.
   * 
   * @param endianness Endianness to use
   */
  setEndianness(endianness: Endianness) {
    this._endianness = endianness;
  }

  /**
   * Advances the offset by the given number of bytes.
   *
   * @param bytes The number of bytes to skip
   * @returns The new offset after skipping bytes
   */
  skip(bytes: number): number;
  /**
   * Advances the offset by the given number of bytes.
   * 
   * @deprecated Passing bigints is no longer supported
   * @param bytes The number of bytes to skip
   * @returns The new offset after skipping bytes
   */
  skip(bytes: bigint): number;
  skip(bytes: number | bigint): number {
    return this._offset += Number(bytes);
  }

  /**
   * Temporarily sets the endianness to the given value, calls the given
   * function, and then restores the original endianness.
   * 
   * @param endianness Endianness to use in scope of function
   * @param fn Function to call
   * @returns Result of the given function call
   */
  withEndianness<T>(endianness: Endianness, fn: () => T): T {
    const originalEndianness = this.endianness;
    this._endianness = endianness;
    const result = fn();
    this._endianness = originalEndianness;
    return result;
  }

  /**
   * Temporarily sets the offset to the given value, calls the given function,
   * and then restores the original offset.
   * 
   * @param offset Offset to use in scope of function
   * @param fn Function to call
   * @returns Result of the given function call
   */
  withOffset<T>(offset: number, fn: () => T): T {
    const originalOffset = this.offset;
    this._offset = offset;
    const result = fn();
    this._offset = originalOffset;
    return result;
  }

  //#endregion

  //#region Deprecated Methods

  // These methods are included for backwards compatibility with @s4tk/encoding

  /**
   * Returns whether or not the offset is at the end of the file (i.e. reading
   * anything will cause an exception).
   * 
   * @deprecated Use `isOutOfBounds` getter instead
   * @returns True if offset is at EOF, false otherwise
   */
  isEOF(): boolean {
    return this.offset >= this.buffer.length;
  }

  /**
   * Preserves the original offset after calling the given function.
   * 
   * @deprecated Use `saveOffset()` method instead
   * @param fn Function to call
   */
  savePos<T>(fn: () => T): T {
    return this.saveOffset(fn);
  }

  /**
   * Returns the current offset.
   * 
   * @deprecated Use `offset` getter instead
   * @returns The current offset
   */
  tell(): number {
    return this.offset;
  }

  //#endregion

  //#region Protected Methods

  protected _resolveEndian<T extends EndianResolvableType>(le: T, be: T): T {
    return this.endianness === "LE" ? le : be;
  }

  //#endregion
}
