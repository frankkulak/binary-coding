import { expect } from "chai";
import { BinaryDecoder, Endianness } from "../dst/binary-coding";
import { describeBinaryCoderMethods } from "./binary-coder-base";
import type { NumberMethodArgs } from "./types";

//#region Helpers

function testNumberMethod(args: NumberMethodArgs<BinaryDecoder>) {
  function testValue(value: number | bigint, endianness: Endianness, offset = 0) {
    const buffer = Buffer.alloc(args.bytes + offset);
    const writeMethod = endianness === "LE" ? args.methodLE : args.methodBE;
    buffer[writeMethod].call(buffer, value, offset);
    const decoder = new BinaryDecoder(buffer, offset, endianness);
    const actual = decoder[args.name].call(decoder);
    if (args.floatEquality) {
      expect(actual).to.be.approximately(value as number, 0.0001);
    } else {
      expect(actual).to.equal(value);
    }
  }

  const endianOptions: Endianness[] = ["LE", "BE"];
  if (args.isSigned) {
    endianOptions.forEach(endianness => {
      it(`should read a positive ${args.name} (${endianness})`, () => {
        testValue(args.value, endianness);
      });

      it(`should read a negative ${args.name} (${endianness})`, () => {
        testValue(-args.value, endianness);
      });
    });
  } else {
    endianOptions.forEach(endianness => {
      it(`should read a ${args.name} (${endianness})`, () => {
        testValue(args.value, endianness);
      });
    });
  }

  it("should read from the current offset", () => {
    testValue(args.value, "LE", 2);
  });

  it(`should advance the offset by ${args.bytes}`, () => {
    const buffer = Buffer.alloc(args.bytes);
    buffer[args.methodLE].call(buffer, args.value);
    const decoder = new BinaryDecoder(buffer);
    decoder[args.name].call(decoder);
    expect(decoder.offset).to.equal(args.bytes);
  });

  it("should throw if going beyond buffer length", () => {
    const buffer = Buffer.alloc(args.bytes);
    buffer[args.methodLE].call(buffer, args.value);
    const decoder = new BinaryDecoder(buffer, 1);
    expect(() => decoder[args.name].call(decoder)).to.throw();
  });
}

//#endregion

describe("BinaryDecoder", () => {
  describeBinaryCoderMethods({
    createCoder(size, offset, endianness) {
      return new BinaryDecoder(Buffer.alloc(size), offset, endianness);
    }
  });

  //#region Initialization

  describe("#constructor()", () => {
    it("should use the given buffer", () => {
      const buffer = Buffer.alloc(5);
      const decoder = new BinaryDecoder(buffer);
      expect(decoder.buffer).to.equal(buffer);
    });

    it("should use the given initial offset", () => {
      const buffer = Buffer.alloc(5);
      const decoder = new BinaryDecoder(buffer, 2);
      expect(decoder.offset).to.equal(2);
    });

    it("should use the given endianness (LE)", () => {
      const buffer = Buffer.alloc(5);
      const decoder = new BinaryDecoder(buffer, 0, "LE");
      expect(decoder.endianness).to.equal("LE");
    });

    it("should use the given endianness (BE)", () => {
      const buffer = Buffer.alloc(5);
      const decoder = new BinaryDecoder(buffer, 0, "BE");
      expect(decoder.endianness).to.equal("BE");
    });

    it("should use offset of 0 by default", () => {
      const buffer = Buffer.alloc(5);
      const decoder = new BinaryDecoder(buffer);
      expect(decoder.offset).to.equal(0);
    });

    it("should use little endian by default", () => {
      const buffer = Buffer.alloc(5);
      const decoder = new BinaryDecoder(buffer);
      expect(decoder.endianness).to.equal("LE");
    });
  });

  //#endregion

  //#region Text / Strings

  describe("#charsUtf8()", () => {
    it("should decode the given number of bytes as UTF-8 chars", () => {
      const decoder = new BinaryDecoder(Buffer.from("test"));
      expect(decoder.charsUtf8(4)).to.equal("test");
    });

    it("should read from the current offset", () => {
      const buffer = Buffer.concat([Buffer.alloc(2), Buffer.from("test")]);
      const decoder = new BinaryDecoder(buffer, 2);
      expect(decoder.charsUtf8(4)).to.equal("test");
    });

    it("should advance the offset by the given byte length", () => {
      const decoder = new BinaryDecoder(Buffer.from("test"));
      decoder.charsUtf8(4)
      expect(decoder.offset).to.equal(4);
    });

    it("should NOT throw if going beyond buffer length", () => {
      const decoder = new BinaryDecoder(Buffer.from("tes"));
      expect(() => decoder.charsUtf8(4)).to.not.throw();
    });
  });

  describe("#charsBase64()", () => {
    it("should decode the given number of bytes as Base64 chars", () => {
      const buffer = Buffer.from("test", "base64");
      const byteLength = buffer.byteLength;
      const decoder = new BinaryDecoder(buffer);
      expect(decoder.charsBase64(byteLength)).to.equal("test");
    });

    it("should read from the current offset", () => {
      const buffer = Buffer.from("test", "base64");
      const byteLength = buffer.byteLength;
      const decoder = new BinaryDecoder(Buffer.concat([Buffer.alloc(2), buffer]), 2);
      expect(decoder.charsBase64(byteLength)).to.equal("test");
    });

    it("should advance the offset by the given byte length", () => {
      const buffer = Buffer.from("test", "base64");
      const byteLength = buffer.byteLength;
      const decoder = new BinaryDecoder(buffer);
      decoder.charsBase64(byteLength);
      expect(decoder.offset).to.equal(byteLength);
    });

    it("should NOT throw if going beyond buffer length", () => {
      const decoder = new BinaryDecoder(Buffer.alloc(0));
      expect(() => decoder.charsBase64(4)).to.not.throw();
    });
  });

  describe("#string()", () => {
    it("should decode bytes as a UTF-8 until a null terminator is found", () => {
      const buffer = Buffer.alloc(5);
      buffer.write("test");
      const decoder = new BinaryDecoder(buffer);
      expect(decoder.string()).to.equal("test");
    });

    it("should read from the current offset", () => {
      const buffer = Buffer.alloc(5);
      buffer.write("test");
      const decoder = new BinaryDecoder(Buffer.concat([Buffer.alloc(2), buffer]), 2);
      expect(decoder.string()).to.equal("test");
    });

    it("should advance the offset by the byte length of the string, plus 1", () => {
      const buffer = Buffer.alloc(5);
      buffer.write("test");
      const decoder = new BinaryDecoder(buffer);
      decoder.string();
      expect(decoder.offset).to.equal(5);
    });

    it("should throw if there is no null terminator byte", () => {
      const buffer = Buffer.alloc(4);
      buffer.write("test");
      const decoder = new BinaryDecoder(buffer);
      expect(() => decoder.string()).to.throw();
    });
  });

  //#endregion

  //#region Bytes / Buffers

  describe("#boolean()", () => {
    it("should decode 0 as false", () => {
      const decoder = new BinaryDecoder(Buffer.from([0]));
      expect(decoder.boolean()).to.be.false;
    });

    it("should decode 1 as true", () => {
      const decoder = new BinaryDecoder(Buffer.from([1]));
      expect(decoder.boolean()).to.be.true;
    });

    it("should decode value other than 0 or 1 as true", () => {
      const decoder = new BinaryDecoder(Buffer.from([5]));
      expect(decoder.boolean()).to.be.true;
    });

    it("should read from the current offset", () => {
      const decoder = new BinaryDecoder(Buffer.from([1, 0]), 1);
      expect(decoder.boolean()).to.be.false;
    });

    it("should advance the offset by 1", () => {
      const decoder = new BinaryDecoder(Buffer.from([0]));
      decoder.boolean();
      expect(decoder.offset).to.equal(1);
    });

    it("should throw if going beyond buffer length", () => {
      const decoder = new BinaryDecoder(Buffer.alloc(0));
      expect(() => decoder.boolean()).to.throw();
    });
  });

  describe("#byte()", () => {
    testNumberMethod({
      name: "byte",
      bytes: 1,
      methodLE: "writeUInt8",
      methodBE: "writeUInt8",
      value: 0x12
    });
  });

  describe("#bytes()", () => {
    it("should read an array of the given number of bytes", () => {
      const decoder = new BinaryDecoder(Buffer.from([2, 4, 8, 16]));
      const [first, second, third, fourth] = decoder.bytes(4);
      expect(first).to.equal(2);
      expect(second).to.equal(4);
      expect(third).to.equal(8);
      expect(fourth).to.equal(16);
    });

    it("should read from the current offset", () => {
      const decoder = new BinaryDecoder(Buffer.from([0, 0, 2, 4]), 2);
      const [first, second] = decoder.bytes(2);
      expect(first).to.equal(2);
      expect(second).to.equal(4);
    });

    it("should advance the offset by the given byte length", () => {
      const decoder = new BinaryDecoder(Buffer.from([2, 4]));
      decoder.bytes(2);
      expect(decoder.offset).to.equal(2);
    });

    it("should throw if going beyond buffer length", () => {
      const decoder = new BinaryDecoder(Buffer.from([0]));
      expect(() => decoder.bytes(2)).to.throw();
    });
  });

  describe("#slice()", () => {
    it("should read a sub-buffer of the given length", () => {
      const decoder = new BinaryDecoder(Buffer.from([2, 4, 8, 16]));
      const subbuffer = decoder.slice(2);
      expect(subbuffer).to.be.an.instanceOf(Buffer).with.lengthOf(2);
      expect([...subbuffer]).to.deep.equal([2, 4]);
    });

    it("should read from the current offset", () => {
      const decoder = new BinaryDecoder(Buffer.from([0, 0, 2, 4, 8]), 2);
      const subbuffer = decoder.slice(2);
      expect(subbuffer).to.be.an.instanceOf(Buffer).with.lengthOf(2);
      expect([...subbuffer]).to.deep.equal([2, 4]);
    });

    it("should advance the offset by the given byte length", () => {
      const decoder = new BinaryDecoder(Buffer.from([2, 4, 8, 16]));
      decoder.slice(2);
      expect(decoder.offset).to.equal(2);
    });

    it("should NOT throw if going beyond buffer length", () => {
      const decoder = new BinaryDecoder(Buffer.from([2, 4, 8, 16]));
      expect(() => decoder.slice(5)).to.not.throw();
    });
  });

  //#endregion

  //#region Numbers

  describe("#uint8()", () => {
    testNumberMethod({
      name: "uint8",
      bytes: 1,
      methodLE: "writeUInt8",
      methodBE: "writeUInt8",
      value: 0x12
    });
  });

  describe("#uint16()", () => {
    testNumberMethod({
      name: "uint16",
      bytes: 2,
      methodLE: "writeUInt16LE",
      methodBE: "writeUInt16BE",
      value: 0x1234
    });
  });

  describe("#uint32()", () => {
    testNumberMethod({
      name: "uint32",
      bytes: 4,
      methodLE: "writeUInt32LE",
      methodBE: "writeUInt32BE",
      value: 0x12345678
    });
  });

  describe("#uint64()", () => {
    testNumberMethod({
      name: "uint64",
      bytes: 8,
      methodLE: "writeBigUInt64LE",
      methodBE: "writeBigUInt64BE",
      value: 0x1234567890ABCDEFn
    });
  });

  describe("#int8()", () => {
    testNumberMethod({
      name: "int8",
      bytes: 1,
      methodLE: "writeInt8",
      methodBE: "writeInt8",
      isSigned: true,
      value: 0x12
    });
  });

  describe("#int16()", () => {
    testNumberMethod({
      name: "int16",
      bytes: 2,
      methodLE: "writeInt16LE",
      methodBE: "writeInt16BE",
      isSigned: true,
      value: 0x1234
    });
  });

  describe("#int32()", () => {
    testNumberMethod({
      name: "int32",
      bytes: 4,
      methodLE: "writeInt32LE",
      methodBE: "writeInt32BE",
      isSigned: true,
      value: 0x12345678
    });
  });

  describe("#int64()", () => {
    testNumberMethod({
      name: "int64",
      bytes: 8,
      methodLE: "writeBigInt64LE",
      methodBE: "writeBigInt64BE",
      isSigned: true,
      value: 0x1234567890ABCDEFn
    });
  });

  describe("#float()", () => {
    testNumberMethod({
      name: "float",
      bytes: 4,
      methodLE: "writeFloatLE",
      methodBE: "writeFloatBE",
      floatEquality: true,
      isSigned: true,
      value: 12.34
    });
  });

  describe("#double()", () => {
    testNumberMethod({
      name: "double",
      bytes: 8,
      methodLE: "writeDoubleLE",
      methodBE: "writeDoubleBE",
      floatEquality: true,
      isSigned: true,
      value: 1234.5678
    });
  });

  //#endregion
});
