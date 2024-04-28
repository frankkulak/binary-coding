import BinaryCoderBase from "./binary-coder-base";
import { BitMasking, type DecoderBitMaskings } from "./bit-masking";
import type { BufferReadBigIntMethod, BufferReadNumberMethod, Endianness } from "./types";

/**
 * Decodes binary data from a buffer.
 */
export default class BinaryDecoder extends BinaryCoderBase {
  //#region Initialization

  /**
   * Creates a new {@link BinaryDecoder} that can read the given buffer.
   * 
   * @param buffer Buffer to decode.
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

  //#endregion

  //#region Text / Encoded Bytes

  /**
   * Reads the given number of bytes as a string with the given encoding.
   * 
   * @param bytes Number of bytes to read.
   * @param encoding Character encoding to parse with ("utf-8" by default).
   * @returns String parsed with given encoding.
   * @throws If buffer does not contain the specified number of bytes.
   */
  chars(bytes: number, encoding: BufferEncoding = "utf-8"): string {
    if (!this.hasClearance(bytes))
      throw new RangeError("Cannot read characters beyond buffer bounds.");
    const end = this.offset + bytes;
    const result = this.buffer.toString(encoding, this.offset, end);
    this.seek(end);
    return result;
  }

  /**
   * Reads bytes until a null byte is found, parses them as a string with the
   * given encoding, and returns the result. The offset will be advanced by the
   * byte length + 1 (for the null byte).
   * 
   * @param encoding Character encoding to parse with ("utf-8" by default).
   * @returns String parsed with given encoding.
   * @throws If there is no null byte between current offset and end of buffer.
   */
  terminatedString(encoding: BufferEncoding = "utf-8"): string {
    const start = this.offset;
    let nextByte = this.byte();
    if (!nextByte) return "";
    while (nextByte) nextByte = this.byte();
    return this.buffer.toString(encoding, start, this.offset - 1);
  }

  /**
   * Reads the given number of bytes as a string of UTF-8 characters.
   * 
   * @deprecated Use {@link chars} instead.
   * @param bytes Number of bytes to read.
   * @returns The characters read as a string with UTF-8 encoding.
   * @throws If buffer does not contain the specified number of bytes.
   */
  charsUtf8(bytes: number): string {
    return this.chars(bytes, "utf-8");
  }

  /**
   * Reads the given number of bytes as a string of Base64 characters.
   * 
   * @deprecated Use {@link chars} instead (use "base64" as second argument).
   * @param bytes Number of bytes to read.
   * @returns The characters read as a string with Base64 encoding.
   * @throws If buffer does not contain the specified number of bytes.
   */
  charsBase64(bytes: number): string {
    return this.chars(bytes, "base64");
  }

  /**
   * Reads bytes until a null byte is found, parses them as a string with UTF-8
   * encoding, and returns the result. The offset will be advanced by the byte
   * length + 1 (for the null byte).
   * 
   * @deprecated Use {@link terminatedString} instead.
   * @returns The string read with UTF-8 encoding.
   * @throws If there is no null byte between current offset and end of buffer.
   */
  string(): string {
    return this.terminatedString("utf-8");
  }

  //#endregion Text / Encoded Bytes

  //#region Raw Bytes / Buffers

  /**
   * Reads the next byte as a boolean (0 is false, anything else is true).
   * 
   * @returns The boolean value of the next byte.
   * @throws If buffer does not contain at least 1 more byte.
   */
  boolean(): boolean {
    return this.byte() !== 0;
  }

  /**
   * Reads a single byte as a UInt8 (alias of {@link uint8}).
   * 
   * @returns A single byte value.
   * @throws If buffer does not contain at least 1 more byte.
   */
  byte(): number {
    return this.uint8();
  }

  /**
   * Reads the given number of bytes as UInt8s.
   * 
   * @param num The number of bytes to read.
   * @returns An array of bytes.
   * @throws If buffer does not contain the specified number of bytes.
   */
  bytes(num: number): number[] {
    const bytes = [];
    for (let i = 0; i < num; i++) bytes.push(this.uint8());
    return bytes;
  }

  /**
   * Slices a sub-buffer of the given size starting at the current offset.
   * 
   * @deprecated Use {@link subarray} instead.
   * @param size Size of the sub-buffer to slice.
   * @returns The sliced buffer.
   * @throws If buffer does not contain the specified number of bytes.
   */
  slice(size: number): Buffer {
    return this.subarray(size);
  }

  /**
   * Reads the given number of bytes into a subarray buffer.
   * 
   * @param size Number of bytes to read into subarray.
   * @returns Buffer containing read bytes.
   * @throws If buffer does not contain the specified number of bytes.
   */
  subarray(size: number): Buffer {
    if (!this.hasClearance(size))
      throw new RangeError("Cannot read a subarray beyond bounds.");
    const end = this.offset + size;
    const slice = this.buffer.subarray(this.offset, end);
    this.seek(end);
    return slice;
  }

  //#endregion Raw Bytes / Buffers

  //#region Numbers

  private _number(
    bytes: number,
    method: BufferReadNumberMethod,
    maskings?: DecoderBitMaskings
  ): number | number[] {
    const value = this.buffer[method](this.offset);
    this.skip(bytes);
    if (!maskings) return value;
    return BitMasking.decode(bytes * 8, maskings.bits, value);
  }

  private _bigint(
    method: BufferReadBigIntMethod,
    maskings?: DecoderBitMaskings
  ): bigint | bigint[] {
    const value = this.buffer[method](this.offset);
    this.skip(8);
    if (!maskings) return value;
    return BitMasking.decode(64, maskings.bits, value);
  }

  /**
   * Reads an 8-bit unsigned integer. Consumes 1 byte.
   * 
   * @returns The read UInt8.
   * @throws If buffer does not contain at least 1 more byte.
   */
  uint8(): number;
  /**
   * Reads an 8-bit unsigned integer, applies the given bit masks, and returns
   * the masked values in an array. Consumes 1 byte.
   * 
   * ```ts
   * // flag is the first bit, value is the remaining 7
   * const [flag, value] = decoder.uint8({ bits: [1, 7] });
   * ```
   * 
   * @param maskings Bit masks to apply to decoded value.
   * @returns Array of values after applying bit masks to the read UInt8.
   * @throws If buffer does not contain at least 1 more byte, or if bit masks
   * are not valid.
   */
  uint8(maskings: DecoderBitMaskings): number[];
  uint8(maskings?: DecoderBitMaskings): number | number[] {
    return this._number(1, "readUInt8", maskings);
  }

  /**
   * Reads a 16-bit unsigned integer. Consumes 2 bytes.
   * 
   * @returns The read UInt16.
   * @throws If buffer does not contain at least 2 more bytes.
   */
  uint16(): number;
  /**
   * Reads a 16-bit unsigned integer, applies the given bit masks, and returns
   * the masked values in an array. Consumes 2 bytes.
   * 
   * ```ts
   * // flag is the first bit, value is the remaining 15
   * const [flag, value] = decoder.uint16({ bits: [1, 15] });
   * ```
   * 
   * @param maskings Bit masks to apply to decoded value.
   * @returns Array of values after applying bit masks to the read UInt16.
   * @throws If buffer does not contain at least 2 more bytes, or if bit masks
   * are not valid.
   */
  uint16(maskings: DecoderBitMaskings): number[];
  uint16(maskings?: DecoderBitMaskings): number | number[] {
    const method = this._resolveEndian("readUInt16LE", "readUInt16BE");
    return this._number(2, method, maskings);
  }

  /**
   * Reads a 32-bit unsigned integer. Consumes 4 bytes.
   * 
   * @returns The read UInt32.
   * @throws If buffer does not contain at least 4 more bytes.
   */
  uint32(): number;
  /**
   * Reads a 32-bit unsigned integer, applies the given bit masks, and returns
   * the masked values in an array. Consumes 4 bytes.
   * 
   * ```ts
   * // flag is the first bit, value is the remaining 31
   * const [flag, value] = decoder.uint32({ bits: [1, 31] });
   * ```
   * 
   * @param maskings Bit masks to apply to decoded value.
   * @returns Array of values after applying bit masks to the read UInt32.
   * @throws If buffer does not contain at least 4 more bytes, or if bit masks
   * are not valid.
   */
  uint32(maskings: DecoderBitMaskings): number[];
  uint32(maskings?: DecoderBitMaskings): number | number[] {
    const method = this._resolveEndian("readUInt32LE", "readUInt32BE");
    return this._number(4, method, maskings);
  }

  /**
   * Reads a 64-bit unsigned integer. Consumes 8 bytes.
   * 
   * @returns The read UInt64.
   * @throws If buffer does not contain at least 8 more bytes.
   */
  uint64(): bigint;
  /**
   * Reads a 64-bit unsigned integer, applies the given bit masks, and returns
   * the masked values in an array. Consumes 8 bytes.
   * 
   * ```ts
   * // flag is the first bit, value is the remaining 63
   * const [flag, value] = decoder.uint64({ bits: [1, 63] });
   * ```
   * 
   * @param maskings Bit masks to apply to decoded value.
   * @returns Array of values after applying bit masks to the read UInt64.
   * @throws If buffer does not contain at least 8 more bytes, or if bit masks
   * are not valid.
   */
  uint64(maskings: DecoderBitMaskings): bigint[];
  uint64(maskings?: DecoderBitMaskings): bigint | bigint[] {
    const method = this._resolveEndian("readBigUInt64LE", "readBigUInt64BE");
    return this._bigint(method, maskings);
  }

  /**
   * Reads an 8-bit signed integer. Consumes 1 byte.
   * 
   * @returns The read Int8.
   * @throws If buffer does not contain at least 1 more byte.
   */
  int8(): number {
    return this._number(1, "readInt8") as number;
  }

  /**
   * Reads a 16-bit signed integer. Consumes 2 bytes.
   * 
   * @returns The read Int16.
   * @throws If buffer does not contain at least 2 more bytes.
   */
  int16(): number {
    const method = this._resolveEndian("readInt16LE", "readInt16BE");
    return this._number(2, method) as number;
  }

  /**
   * Reads a 32-bit signed integer. Consumes 4 bytes.
   * 
   * @returns The read Int32.
   * @throws If buffer does not contain at least 4 more bytes.
   */
  int32(): number {
    const method = this._resolveEndian("readInt32LE", "readInt32BE");
    return this._number(4, method) as number;
  }

  /**
   * Reads a 64-bit signed integer. Consumes 8 bytes.
   * 
   * @returns The read Int64.
   * @throws If buffer does not contain at least 8 more bytes.
   */
  int64(): bigint {
    const method = this._resolveEndian("readBigInt64LE", "readBigInt64BE");
    return this._bigint(method) as bigint;
  }

  /**
   * Reads a float. Consumes 4 bytes.
   * 
   * @returns The read float.
   * @throws If buffer does not contain at least 4 more bytes.
   */
  float(): number {
    const method = this._resolveEndian("readFloatLE", "readFloatBE");
    return this._number(4, method) as number;
  }

  /**
   * Reads a double. Consumes 8 bytes.
   * 
   * @returns The read double.
   * @throws If buffer does not contain at least 8 more bytes.
   */
  double(): number {
    const method = this._resolveEndian("readDoubleLE", "readDoubleBE");
    return this._number(8, method) as number;
  }

  //#endregion Numbers
}
