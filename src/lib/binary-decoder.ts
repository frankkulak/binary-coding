import BinaryCoderBase from "./binary-coder-base";
import type { BufferReadBigIntMethod, BufferReadNumberMethod, Endianness } from "./types";

/**
 * A class for decoding binary files. The decoder keeps track of an offset,
 * which is incremented every time a value is read.
 */
export default class BinaryDecoder extends BinaryCoderBase {
  //#region Initialization

  /**
   * Creates a new BinaryDecoder that can read the given buffer.
   * 
   * @param buffer Buffer to decode
   * @param initialOffset Initial offset to use. 0 by default.
   * @param endianness Endianness to use(little endian by default)
   */
  constructor(
    buffer: Buffer,
    initialOffset: number = 0,
    endianness: Endianness = "LE"
  ) {
    super(buffer, initialOffset, endianness);
  }

  //#endregion

  //#region Text / Encoded Bytes

  /**
   * Reads the given number of bytes as characters in the given encoding.
   * 
   * @param num Number of bytes to read
   * @param encoding Encoding to read bytes as
   * @returns The characters read as a string
   */
  private _chars(num: number, encoding: string): string {
    const end = this.offset + num;
    //@ts-ignore: Importing Encoding is a pain, and is not necessary at all
    const result = this.buffer.toString(encoding, this.offset, end);
    this.seek(end);
    return result;
  }

  /**
   * Reads the given number of bytes as a string of UTF-8 characters.
   * 
   * @param num Number of bytes to read
   * @returns The characters read
   */
  charsUtf8(num: number): string {
    return this._chars(num, "utf-8");
  }

  /**
   * Reads the given number of bytes as a string of Base64 characters.
   * 
   * @param num Number of bytes to read
   * @returns The characters read
   */
  charsBase64(num: number): string {
    return this._chars(num, "base64");
  }

  /**
   * Reads bytes until a null byte is found, parses them as a UTF-8 string. The
   * offset will be left on the final null byte.
   * 
   * @returns The string read
   */
  string(): string {
    const start = this.tell();
    let nextByte = this.byte();
    if (!nextByte) return "";
    while (nextByte) nextByte = this.byte();
    return this.buffer.toString("utf8", start, this.offset - 1);
  }

  //#endregion Text / Encoded Bytes

  //#region Raw Bytes / Buffers

  /**
   * Reads the next byte as a boolean (0 is false, anything else is true).
   * 
   * @returns The boolean value of the next byte
   */
  boolean(): boolean {
    return this.byte() !== 0;
  }

  /**
   * Reads a single byte. This is an alias for `uint8()`.
   * 
   * @returns A single byte value
   */
  byte(): number {
    return this.uint8();
  }

  /**
   * Reads the given number of raw bytes.
   * 
   * @param num The number of bytes to read
   * @returns An array of bytes
   */
  bytes(num: number): number[] {
    const bytes = [];
    for (let i = 0; i < num; i++) bytes.push(this.uint8());
    return bytes;
  }

  /**
   * Slices a sub-buffer of the given size starting at the current offset.
   * 
   * @param size Size of the sub-buffer to slice
   * @returns The sliced buffer
   */
  slice(size: number): Buffer {
    const end = this.offset + size;
    const slice = this.buffer.slice(this.offset, end);
    this.seek(end);
    return slice;
  }

  //#endregion Raw Bytes / Buffers

  //#region Numbers

  /**
   * Reads a number using the given Buffer method.
   * 
   * @param methodName The method to call on the buffer
   * @param numBytes The number of bytes to advance the offset by
   * @returns The read number
   */
  private _number(methodName: BufferReadNumberMethod, numBytes: number): number {
    const result = this.buffer[methodName](this.offset);
    this.skip(numBytes);
    return result;
  }

  /**
   * Reads a bigint using the given Buffer method.
   * 
   * @param methodName The method to call on the buffer
   * @returns The read bigint
   */
  private _bigint(methodName: BufferReadBigIntMethod): bigint {
    const result = this.buffer[methodName](this.offset);
    this.skip(8);
    return result;
  }

  /**
   * Reads an 8-bit unsigned integer.
   * 
   * @returns The read uint8
   */
  uint8(): number {
    return this._number("readUInt8", 1);
  }

  /**
   * Reads a 16-bit unsigned integer.
   * 
   * @returns The read uint16
   */
  uint16(): number {
    return this._number(
      this._resolveEndian("readUInt16LE", "readUInt16BE"),
      2
    );
  }

  /**
   * Reads a 32-bit unsigned integer.
   * 
   * @returns The read uint32
   */
  uint32(): number {
    return this._number(
      this._resolveEndian("readUInt32LE", "readUInt32BE"),
      4
    );
  }

  /**
   * Reads a 64-bit unsigned integer.
   * 
   * @returns The read uint64
   */
  uint64(): bigint {
    return this._bigint(
      this._resolveEndian("readBigUInt64LE", "readBigUInt64BE")
    );
  }

  /**
   * Reads an 8-bit signed integer.
   * 
   * @returns The read int8
   */
  int8(): number {
    return this._number("readInt8", 1);
  }

  /**
   * Reads a 16-bit signed integer.
   * 
   * @returns The read int16
   */
  int16(): number {
    return this._number(
      this._resolveEndian("readInt16LE", "readInt16BE"),
      2
    );
  }

  /**
   * Reads a 32-bit signed integer.
   * 
   * @returns The read int32
   */
  int32(): number {
    return this._number(
      this._resolveEndian("readInt32LE", "readInt32BE"),
      4
    );
  }

  /**
   * Reads a 64-bit signed integer.
   * 
   * @returns The read int64
   */
  int64(): bigint {
    return this._bigint(
      this._resolveEndian("readBigInt64LE", "readBigInt64BE")
    );
  }

  /**
   * Reads a float.
   * 
   * @returns The read float
   */
  float(): number {
    return this._number(
      this._resolveEndian("readFloatLE", "readFloatBE"),
      4
    );
  }

  /**
   * Reads a double.
   * 
   * @returns The read double
   */
  double(): number {
    return this._number(
      this._resolveEndian("readDoubleLE", "readDoubleBE"),
      8
    );
  }

  //#endregion Numbers
}