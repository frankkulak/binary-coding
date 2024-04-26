/** Types of endianness (big or little). */
export type Endianness = "BE" | "LE";

export type BufferReadNumberMethod =
  "readUInt8" |
  "readUInt16LE" |
  "readUInt16BE" |
  "readUInt32LE" |
  "readUInt32BE" |
  "readInt8" |
  "readInt16LE" |
  "readInt16BE" |
  "readInt32LE" |
  "readInt32BE" |
  "readFloatLE" |
  "readFloatBE" |
  "readDoubleLE" |
  "readDoubleBE";

export type BufferReadBigIntMethod =
  "readBigUInt64LE" |
  "readBigUInt64BE" |
  "readBigInt64LE" |
  "readBigInt64BE";

export type BufferWriteNumberMethod =
  "writeUInt8" |
  "writeUInt16LE" |
  "writeUInt16BE" |
  "writeUInt32LE" |
  "writeUInt32BE" |
  "writeInt8" |
  "writeInt16LE" |
  "writeInt16BE" |
  "writeInt32LE" |
  "writeInt32BE" |
  "writeFloatLE" |
  "writeFloatBE" |
  "writeDoubleLE" |
  "writeDoubleBE";

export type BufferWriteBigIntMethod =
  "writeBigUInt64LE" |
  "writeBigUInt64BE" |
  "writeBigInt64LE" |
  "writeBigInt64BE";

export type EndianResolvableType =
  BufferReadNumberMethod |
  BufferReadBigIntMethod |
  BufferWriteNumberMethod |
  BufferWriteBigIntMethod;
