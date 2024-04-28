//#region Types

interface BitMaskings {
  /**
   * List of bit masks to use. Masks must add up to the total bit size of the
   * associated data type, such as:
   * ```ts
   * // ok
   * uint32({ bits: [1, 31] }); // 1 + 31 == 32
   * uint64({ bits: [2, 2, 60] }); // 2 + 2 + 60 == 64
   * 
   * // exception!
   * uint32({ bits: [1, 9] }); // 1 + 9 != 32
   * uint64({ bits: [2, 2, 64] }); // 2 + 2 + 64 != 64
   * ```
  */
  bits: number[];
}

/**
 * Specifies bit maskings to use when reading unsigned ints.
 */
export interface DecoderBitMaskings extends BitMaskings { }

/**
 * Specifies which values to write in which bits when writing an unsigned int.
 */
export interface EncoderBitMaskings<ValueType extends number | bigint> extends BitMaskings {
  /**
   * List of values to write for each bit mask. Values must fit within the bit
   * restriction they correspond with, such as:
   * ```ts
   * // ok
   * uint32({ bits: [1, …], values: [1, …] }); // 1 fits in 1 bit
   * uint64({ bits: [4, …], values: [10, …] }); // 10 fits in 4 bits
   * 
   * // exception!
   * uint32({ bits: [1, …], values: [2, …] }); // 2 does NOT fit in 1 bit
   * uint64({ bits: [2, …], values: [10, …] }); // 10 does NOT fit in 2 bits
   * ```
   */
  values: ValueType[];
}

//#endregion

/**
 * Utilities for bit masking.
 */
export namespace BitMasking {
  /**
   * Splits the given value into multiple by applying the given bit masks.
   * 
   * @param bits Number of bits this number fits into.
   * @param masks List of bit masks to apply.
   * @param value Value to apply bit masks to.
   * @returns List of values after applying masks to given value.
   * @throws If masks is empty, doesn't sum to bits, or contains any numbers
   * that aren't positive integers.
   */
  export function decode<T extends number | bigint>(
    bits: number,
    masks: number[],
    value: T
  ): T[] {
    // Important: Do all bit math as bigints; numbers are treated as Int32s,
    // therefore UInt32s become signed at 32 bits and UInt64s lose precision.
    _validateMasks(bits, masks);
    const isBig = typeof value === 'bigint';
    const bigValue = isBig ? value : BigInt(value);
    let remainingBits = BigInt(bits);
    return masks.map(numBits => {
      const bigNumBits = BigInt(numBits);
      remainingBits -= bigNumBits;
      const mask = ((1n << bigNumBits) - 1n) << remainingBits;
      const segmentValue = (bigValue & mask) >> remainingBits;
      return (isBig ? segmentValue : Number(segmentValue)) as T;
    });
  }

  /**
   * Combines the given values into one by applying the given bit masks.
   * 
   * @param bits Number of bits this number fits into.
   * @param masks List of bit masks to apply.
   * @param values Values to apply bit masks to.
   * @returns Result of combining the given values with the given bit masks.
   * @throws If masks is empty, doesn't sum to bits, or contains any numbers
   * that aren't positive integers. Also if length of values != length of masks,
   * any values don't fit in their bit masks, or if any values are not positive
   * integers/bigints.
   */
  export function encode<T extends number | bigint>(
    bits: number,
    masks: number[],
    values: T[]
  ): T {
    // Important: Do all bit math as bigints; numbers are treated as Int32s,
    // therefore UInt32s become signed at 32 bits and UInt64s lose precision.
    _validateMasks(bits, masks);
    _validateValues(masks, values);
    let combinedValue = 0n;
    let remainingBits = BigInt(bits);
    values.forEach((value, i) => {
      remainingBits -= BigInt(masks[i]);
      combinedValue += BigInt(value) << remainingBits;
    });
    return (bits >= 56 ? combinedValue : Number(combinedValue)) as T;
  }

  function _validateMasks(bits: number, masks: number[]) {
    if (masks.length < 1)
      throw new Error("Bit mask list cannot be empty");
    if (masks.some(mask => !(Number.isInteger(mask) && mask > 0)))
      throw new Error("Bit masks must be positive integers");
    if (masks.reduce((a, b) => a + b) !== bits)
      throw new Error(`Bit masks for ${bits}-bit number must add to ${bits}`);
  }

  function _validateValues<T extends number | bigint>(
    masks: number[],
    values: T[]
  ) {
    if (values.length !== masks.length)
      throw new Error("Value must be provided for every bit mask");
    const isInt = (n: number | bigint) =>
      typeof n === "bigint" || Number.isInteger(n);
    if (values.some(value => !(isInt(value) && value >= 0)))
      throw new Error("Values must be non-negative integers");
    values.forEach((value, i) => {
      const bigValue = BigInt(value);
      const mask = BigInt(masks[i]);
      if (bigValue > ((1n << mask) - 1n))
        throw new Error(`Value of ${value} does not fit in ${mask} bits`);
    });
  }
}
