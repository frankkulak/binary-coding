import { expect } from "chai";
import { BinaryEncoder, Endianness } from "../dst/binary-coding";
import type { NumberMethodArgs } from "./types";
import { describeBinaryCoderMethods } from "./coder-base";

//#region Helpers

function testNumberMethod(args: NumberMethodArgs<BinaryEncoder>) {
  function testValue(value: number | bigint, endianness: Endianness, offset = 0) {
    const encoder = BinaryEncoder.alloc(args.bytes + offset, offset, endianness);
    encoder[args.name].call(encoder, value);
    const readMethod = endianness === "LE" ? args.methodLE : args.methodBE;
    const actual = encoder.buffer[readMethod].call(encoder.buffer, offset);
    if (args.floatEquality) {
      expect(actual).to.be.approximately(value as number, 0.00001);
    } else {
      expect(actual).to.equal(value);
    }
  }

  const endianOptions: Endianness[] = ["LE", "BE"];
  if (args.isSigned) {
    endianOptions.forEach(endianness => {
      it(`should write a positive ${args.name} (${endianness})`, () => {
        testValue(args.value, endianness);
      });

      it(`should write a negative ${args.name} (${endianness})`, () => {
        testValue(-args.value, endianness);
      });
    });
  } else {
    endianOptions.forEach(endianness => {
      it(`should write a ${args.name} (${endianness})`, () => {
        testValue(args.value, endianness);
      });
    });
  }

  it("should write at the current offset", () => {
    testValue(args.value, "LE", 2);
  });

  it(`should advance the offset by ${args.bytes}`, () => {
    const encoder = BinaryEncoder.alloc(args.bytes, 0, "LE");
    encoder[args.name].call(encoder, args.value);
    expect(encoder.offset).to.equal(args.bytes);
  });

  it("should throw if going beyond buffer length", () => {
    const encoder = BinaryEncoder.alloc(args.bytes - 1);
    expect(() => encoder[args.name].call(encoder, args.value)).to.throw();
  });
}

//#endregion

describe("BinaryEncoder", () => {
  describeBinaryCoderMethods({
    createCoder(size, offset, endianness) {
      return BinaryEncoder.alloc(size, offset, endianness);
    }
  });

  //#region Initialization

  describe("#constructor()", () => {
    it("should use the given buffer", () => {
      const buffer = Buffer.alloc(5);
      const encoder = new BinaryEncoder(buffer);
      expect(encoder.buffer).to.equal(buffer);
    });

    it("should use the given initial offset", () => {
      const buffer = Buffer.alloc(5);
      const encoder = new BinaryEncoder(buffer, 2);
      expect(encoder.offset).to.equal(2);
    });

    it("should use the given endianness (LE)", () => {
      const buffer = Buffer.alloc(5);
      const encoder = new BinaryEncoder(buffer, 0, "LE");
      expect(encoder.endianness).to.equal("LE");
    });

    it("should use the given endianness (BE)", () => {
      const buffer = Buffer.alloc(5);
      const encoder = new BinaryEncoder(buffer, 0, "BE");
      expect(encoder.endianness).to.equal("BE");
    });

    it("should use offset of 0 by default", () => {
      const buffer = Buffer.alloc(5);
      const encoder = new BinaryEncoder(buffer);
      expect(encoder.offset).to.equal(0);
    });

    it("should use little endian by default", () => {
      const buffer = Buffer.alloc(5);
      const encoder = new BinaryEncoder(buffer);
      expect(encoder.endianness).to.equal("LE");
    });
  });

  describe("#alloc()", () => {
    it("should create a buffer with the given length", () => {
      const encoder = BinaryEncoder.alloc(12);
      expect(encoder.buffer.byteLength).to.equal(12);
    });

    it("should use the given initial offset", () => {
      const encoder = BinaryEncoder.alloc(5, 3, "LE");
      expect(encoder.offset).to.equal(3);
    });

    it("should use the given endianness (LE)", () => {
      const encoder = BinaryEncoder.alloc(5, 0, "LE");
      expect(encoder.endianness).to.equal("LE");
    });

    it("should use the given endianness (BE)", () => {
      const encoder = BinaryEncoder.alloc(5, 0, "BE");
      expect(encoder.endianness).to.equal("BE");
    });

    it("should use offset of 0 by default", () => {
      const encoder = BinaryEncoder.alloc(5);
      expect(encoder.offset).to.equal(0);
    });

    it("should use little endian by default", () => {
      const encoder = BinaryEncoder.alloc(5);
      expect(encoder.endianness).to.equal("LE");
    });
  });

  //#endregion

  //#region Text / Strings

  describe("#charsUtf8()", () => {
    it("should encode the given chars as UTF-8", () => {
      const encoder = BinaryEncoder.alloc(4);
      encoder.charsUtf8("test");
      expect(encoder.buffer.toString()).to.equal("test");
    });

    it("should write at the current offset", () => {
      const encoder = BinaryEncoder.alloc(6, 2);
      encoder.charsUtf8("test");
      expect(encoder.buffer.slice(2, 6).toString()).to.equal("test");
    });

    it("should advance the offset by the byte length of the given chars", () => {
      const encoder = BinaryEncoder.alloc(4);
      encoder.charsUtf8("test");
      expect(encoder.offset).to.equal(4);
    });

    it("should throw if going beyond buffer length", () => {
      const encoder = BinaryEncoder.alloc(3);
      expect(() => encoder.charsUtf8("test")).to.throw();
    });
  });

  describe("#charsBase64()", () => {
    it("should encode the given chars as Base64", () => {
      const bytes = Buffer.byteLength("test", "base64");
      const encoder = BinaryEncoder.alloc(bytes);
      encoder.charsBase64("test");
      expect(encoder.buffer.toString("base64")).to.equal("test");
    });

    it("should write at the current offset", () => {
      const bytes = Buffer.byteLength("test", "base64");
      const encoder = BinaryEncoder.alloc(bytes + 2, 2);
      encoder.charsBase64("test");
      expect(encoder.buffer.slice(2, bytes + 2).toString("base64")).to.equal("test");
    });

    it("should advance the offset by the byte length of the given chars", () => {
      const bytes = Buffer.byteLength("test", "base64");
      const encoder = BinaryEncoder.alloc(bytes);
      encoder.charsBase64("test");
      expect(encoder.offset).to.equal(bytes);
    });

    it("should throw if going beyond buffer length", () => {
      const bytes = Buffer.byteLength("test", "base64");
      const encoder = BinaryEncoder.alloc(bytes - 1);
      expect(() => encoder.charsBase64("test")).to.throw();
    });
  });

  //#endregion

  //#region Bytes / Buffers

  describe("#boolean()", () => {
    it("should encode true as 1", () => {
      const encoder = BinaryEncoder.alloc(1);
      encoder.boolean(true);
      expect(encoder.buffer.readUInt8(0)).to.equal(1);
    });

    it("should encode false as 0", () => {
      const encoder = BinaryEncoder.alloc(1);
      encoder.boolean(false);
      expect(encoder.buffer.readUInt8(0)).to.equal(0);
    });

    it("should write at the current offset", () => {
      const encoder = BinaryEncoder.alloc(3, 2);
      encoder.boolean(true);
      expect(encoder.buffer.readUInt8(2)).to.equal(1);
    });

    it("should advance the offset by 1", () => {
      const encoder = BinaryEncoder.alloc(1);
      encoder.boolean(false);
      expect(encoder.offset).to.equal(1);
    });

    it("should throw if going beyond buffer length", () => {
      const encoder = BinaryEncoder.alloc(1, 1);
      expect(() => encoder.boolean(true)).to.throw();
    });
  });

  describe("#byte()", () => {
    testNumberMethod({
      name: "byte",
      bytes: 1,
      methodLE: "readUInt8",
      methodBE: "readUInt8",
      value: 0x12,
    });
  });

  describe("#bytes()", () => {
    it("should write the given array as bytes", () => {
      const encoder = BinaryEncoder.alloc(4);
      encoder.bytes([2, 4, 8, 16]);
      expect(encoder.buffer.readUInt8(0)).to.equal(2);
      expect(encoder.buffer.readUInt8(1)).to.equal(4);
      expect(encoder.buffer.readUInt8(2)).to.equal(8);
      expect(encoder.buffer.readUInt8(3)).to.equal(16);
    });

    it("should write at the current offset", () => {
      const encoder = BinaryEncoder.alloc(6, 2);
      encoder.bytes([2, 4, 8, 16]);
      expect(encoder.buffer.readUInt8(2)).to.equal(2);
      expect(encoder.buffer.readUInt8(3)).to.equal(4);
      expect(encoder.buffer.readUInt8(4)).to.equal(8);
      expect(encoder.buffer.readUInt8(5)).to.equal(16);
    });

    it("should advance the offset by the length of the given array", () => {
      const encoder = BinaryEncoder.alloc(4);
      encoder.bytes([2, 4, 8, 16]);
      expect(encoder.tell()).to.equal(4);
    });

    it("should throw if going beyond buffer length", () => {
      const encoder = BinaryEncoder.alloc(3);
      expect(() => encoder.bytes([2, 4, 8, 16])).to.throw();
    });
  });

  //#endregion

  //#region Numbers

  describe("#uint8()", () => {
    testNumberMethod({
      name: "uint8",
      bytes: 1,
      methodLE: "readUInt8",
      methodBE: "readUInt8",
      value: 0x12
    });
  });

  describe("#uint16()", () => {
    testNumberMethod({
      name: "uint16",
      bytes: 2,
      methodLE: "readUInt16LE",
      methodBE: "readUInt16BE",
      value: 0x1234
    });
  });

  describe("#uint32()", () => {
    testNumberMethod({
      name: "uint32",
      bytes: 4,
      methodLE: "readUInt32LE",
      methodBE: "readUInt32BE",
      value: 0x12345678
    });
  });

  describe("#uint64()", () => {
    testNumberMethod({
      name: "uint64",
      bytes: 8,
      methodLE: "readBigUInt64LE",
      methodBE: "readBigUInt64BE",
      value: 0x1234567890ABCDEFn
    });
  });

  describe("#int8()", () => {
    testNumberMethod({
      name: "int8",
      bytes: 1,
      methodLE: "readInt8",
      methodBE: "readInt8",
      isSigned: true,
      value: 0x12
    });
  });

  describe("#int16()", () => {
    testNumberMethod({
      name: "int16",
      bytes: 2,
      methodLE: "readInt16LE",
      methodBE: "readInt16BE",
      isSigned: true,
      value: 0x1234
    });
  });

  describe("#int32()", () => {
    testNumberMethod({
      name: "int32",
      bytes: 4,
      methodLE: "readInt32LE",
      methodBE: "readInt32BE",
      isSigned: true,
      value: 0x12345678
    });
  });

  describe("#int64()", () => {
    testNumberMethod({
      name: "int64",
      bytes: 8,
      methodLE: "readBigInt64LE",
      methodBE: "readBigInt64BE",
      isSigned: true,
      value: 0x1234567890ABCDEFn
    });
  });

  describe("#float()", () => {
    testNumberMethod({
      name: "float",
      bytes: 4,
      methodLE: "readFloatLE",
      methodBE: "readFloatBE",
      floatEquality: true,
      isSigned: true,
      value: 12.34
    });
  });

  describe("#double()", () => {
    testNumberMethod({
      name: "double",
      bytes: 8,
      methodLE: "readDoubleLE",
      methodBE: "readDoubleBE",
      floatEquality: true,
      isSigned: true,
      value: 1234.5678
    });
  });

  //#endregion
});
