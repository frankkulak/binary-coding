import BinaryCoderBase from "./binary-coder-base";
import type { BufferWriteBigIntMethod, BufferWriteNumberMethod, Endianness } from "./types";

/**
 * A class for encoding binary files. The encoder keeps track of an offset,
 * which is incremented every time a value is written.
 */
export default class BinaryEncoder extends BinaryCoderBase {
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

  //#endregion

  //#region Text / Encoded Bytes

  /**
   * Writes a string to the buffer using the given encoding.
   * 
   * @param value The characters to write
   * @param encoding The encoding to write the string as
   */
  private _chars(value: string, encoding: string) {
    // intentionally += because write() returns # bytes written
    //@ts-ignore: Importing Encoding is a pain, and is not necessary at all
    this.offset += this.buffer.write(value, this.offset, Buffer.byteLength(value, encoding), encoding);
  }

  /**
   * Writes a string to the buffer using UTF-8 encoding.
   * 
   * @param value The characters to write
   */
  charsUtf8(value: string) { // TODO: deprecate
    this._chars(value, "utf-8");
  }

  /**
   * Writes a string to the buffer using Base64 encoding.
   * 
   * @param value The characters to write
   */
  charsBase64(value: string) { // TODO: deprecate
    this._chars(value, "base64");
  }

  // TODO: arbitrary encoding

  // TODO: null-terminated string w/ arbitrary encoding

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

  //#endregion Raw Bytes / Buffers

  //#region Numbers

  /**
   * Writes a number to the buffer using the given method.
   * 
   * @param value The number to write
   * @param methodName The method to write the number with
   */
  private _number(value: number, methodName: BufferWriteNumberMethod) {
    // intentionally = because all number methods return current offset + # bytes written
    this._offset = this.buffer[methodName](value, this.offset);
  }

  /**
   * Writes a bigint to the buffer using the given method.
   * 
   * @param value The bigint to write
   * @param methodName The method to write the bigint with
   */
  private _bigint(value: bigint, methodName: BufferWriteBigIntMethod) {
    // intentionally = because all number methods return current offset + # bytes written
    this._offset = this.buffer[methodName](value, this.offset);
  }

  /**
   * Writes an 8-bit unsigned integer to the buffer.
   * 
   * @param value The uint8 to write
   */
  uint8(value: number) {
    this._number(value, "writeUInt8");
  }

  /**
   * Writes a 16-bit unsigned integer to the buffer.
   * 
   * @param value The uint16 to write
   */
  uint16(value: number) {
    this._number(
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
    this._number(value, "writeInt8");
  }

  /**
   * Writes a 16-bit signed integer to the buffer.
   * 
   * @param value The int16 to write
   */
  int16(value: number) {
    this._number(
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
      value,
      this._resolveEndian("writeDoubleLE", "writeDoubleBE")
    );
  }

  //#endregion Numbers
}
