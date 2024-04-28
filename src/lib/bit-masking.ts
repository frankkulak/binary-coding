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
  const _BIGINT_THRESHOLD = 56;

  /**
   * TODO:
   * 
   * @param bits Number of bits this number fits into.
   * @param masks List of bit masks to apply.
   * @param value Value to apply bit masks to.
   * @returns List of values after applying masks to given value.
   * @throws TODO:
   */
  export function decode<T extends number | bigint>(
    bits: number,
    masks: number[],
    value: T
  ): T[] {
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
   * TODO:
   * 
   * @param bits Number of bits this number fits into.
   * @param masks List of bit masks to apply.
   * @param values Values to apply bit masks to.
   * @returns Result of combining the given values with the given bit masks.
   * @throws TODO:
   */
  export function encode<T extends number | bigint>(
    bits: number,
    masks: number[],
    values: T[]
  ): T {
    _validateMasks(bits, masks);
    _validateValues(masks, values);
    const useBigInt = bits >= _BIGINT_THRESHOLD;
    let combinedValue = (useBigInt ? 0n : 0) as T;
    let remainingBits = bits;
    values.forEach((value, i) => {
      const numBits = masks[i];
      const bitShift = remainingBits - numBits;
      // FIXME: potential issue here, value could be number in 64 bits
      const shifted = (value << ((useBigInt ? BigInt(bitShift) : bitShift) as T)) as T;
      //@ts-ignore T and T are guaranteed to be the same type here
      combinedValue += shifted;
      remainingBits -= numBits;
    });
    return combinedValue;
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
    if (values.some(value => !(Number.isInteger(value) && value >= 0)))
      throw new Error("Values must be non-negative integers");
    values.forEach((value, i) => {
      const mask = masks[i];
      if (value > ((1 << mask) - 1)) // FIXME: types & sizing of vars here
        throw new Error(`Value of ${value} does not fit in ${mask} bits`);
    });
  }
}
