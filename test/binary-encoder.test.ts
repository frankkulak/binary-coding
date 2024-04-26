import { expect } from "chai";
import { BinaryEncoder, Endianness } from "../dst/binary-coding";
import { describeBinaryCoderMethods } from "./binary-coder-base";
import type { NumberMethodArgs } from "./types";

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

  it("should support dynamic sizing in calls to withDynamicSize()", () => {
    BinaryEncoder.withDynamicSize({
      chunkSize: 1,
      initialOffset: 1,
      builder(encoder) {
        expect(encoder.byteLength).to.equal(1);
        encoder[args.name].call(encoder, args.value);
        expect(encoder.byteLength).to.equal(args.bytes + 1);
      }
    });
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

  describe("static#alloc()", () => {
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

    it("should throw if given size is negative", () => {
      expect(() => BinaryEncoder.alloc(-1)).to.throw();
    });

    it("should throw if given size is not an integer", () => {
      expect(() => BinaryEncoder.alloc(1.5)).to.throw();
    });
  });

  describe("static#withDynamicSize()", () => {
    it("should throw if given minimum size is negative", () => {
      expect(() => BinaryEncoder.withDynamicSize({
        minimumSize: -1,
        builder(_) { }
      })).to.throw();
    });

    it("should throw if given minimum size is not an integer", () => {
      expect(() => BinaryEncoder.withDynamicSize({
        minimumSize: 1.5,
        builder(_) { }
      })).to.throw();
    });

    it("should use the given minimum size as initial size if larger than chunk size", () => {
      BinaryEncoder.withDynamicSize({
        minimumSize: 8,
        chunkSize: 4,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(8);
        }
      });
    });

    it("should use the given chunk size as initial size if larger than minimum size", () => {
      BinaryEncoder.withDynamicSize({
        minimumSize: 4,
        chunkSize: 8,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(8);
        }
      });
    });

    it("should use the given chunk size as initial size if no minimum size", () => {
      BinaryEncoder.withDynamicSize({
        chunkSize: 4,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(4);
        }
      });
    });

    it("should use 256 as initial size if no minimum size or chunk size", () => {
      BinaryEncoder.withDynamicSize({
        builder(encoder) {
          expect(encoder.byteLength).to.equal(256);
        }
      });
    });

    it("should use the given initial offset", () => {
      BinaryEncoder.withDynamicSize({
        initialOffset: 4,
        builder(encoder) {
          expect(encoder.offset).to.equal(4);
        }
      });
    });

    it("should use initial offset of 0 if not provided", () => {
      BinaryEncoder.withDynamicSize({
        builder(encoder) {
          expect(encoder.offset).to.equal(0);
        }
      });
    });

    it("should use the given endianness", () => {
      BinaryEncoder.withDynamicSize({
        endianness: "BE",
        builder(encoder) {
          expect(encoder.endianness).to.equal("BE");
        }
      });
    });

    it("should use little endianness if not provided", () => {
      BinaryEncoder.withDynamicSize({
        builder(encoder) {
          expect(encoder.endianness).to.equal("LE");
        }
      });
    });

    it("should use the given chunk size", () => {
      BinaryEncoder.withDynamicSize({
        chunkSize: 4,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(4);
          encoder.chars("testing");
          expect(encoder.byteLength).to.equal(8);
        }
      });
    });

    it("should use chunk size of 256 if not provided", () => {
      BinaryEncoder.withDynamicSize({
        builder(encoder) {
          expect(encoder.byteLength).to.equal(256);
          encoder.seek(256);
          encoder.chars("testing");
          expect(encoder.byteLength).to.equal(512);
        }
      });
    });

    it("should throw if given chunk size is negative", () => {
      expect(() => BinaryEncoder.withDynamicSize({
        chunkSize: -1,
        builder(_) { }
      })).to.throw();
    });

    it("should throw if given chunk size is 0", () => {
      expect(() => BinaryEncoder.withDynamicSize({
        chunkSize: 0,
        builder(_) { }
      })).to.throw();
    });

    it("should throw if given chunk size is not an integer", () => {
      expect(() => BinaryEncoder.withDynamicSize({
        chunkSize: 1.5,
        builder(_) { }
      })).to.throw();
    });

    it("should execute the given builder function when passed alone", () => {
      let executed = false;
      BinaryEncoder.withDynamicSize((_) => {
        executed = true;
      });
      expect(executed).to.be.true;
    });

    it("should execute the given builder function when passed with options", () => {
      let executed = false;
      BinaryEncoder.withDynamicSize({
        builder(_) {
          executed = true;
        }
      });
      expect(executed).to.be.true;
    });

    it("should resize when writing beyond current byte length", () => {
      BinaryEncoder.withDynamicSize({
        chunkSize: 4,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(4);
          encoder.chars("testing");
          expect(encoder.byteLength).to.equal(8);
        },
      });
    });

    it("should not crop the buffer if size < minimum size", () => {
      const encoder = BinaryEncoder.withDynamicSize({
        minimumSize: 8,
        chunkSize: 8,
        builder(encoder) {
          encoder.chars("test");
        }
      });
      expect(encoder.byteLength).to.equal(8);
    });

    it("should not crop the buffer if size == minimum size", () => {
      const encoder = BinaryEncoder.withDynamicSize({
        minimumSize: 4,
        chunkSize: 4,
        builder(encoder) {
          encoder.chars("test");
        }
      });
      expect(encoder.byteLength).to.equal(4);
    });

    it("should crop the buffer to min size when writing fewer bytes", () => {
      const encoder = BinaryEncoder.withDynamicSize({
        minimumSize: 12,
        builder(encoder) {
          encoder.chars("test");
          encoder.uint32(5);
          encoder.boolean(true);
        }
      });
      expect(encoder.byteLength).to.equal(12);
    });

    it("should crop the buffer to min size when writing exact amount of bytes", () => {
      const encoder = BinaryEncoder.withDynamicSize({
        minimumSize: 9,
        builder(encoder) {
          encoder.chars("test");
          encoder.uint32(5);
          encoder.boolean(true);
        }
      });
      expect(encoder.byteLength).to.equal(9);
    });

    it("should crop the buffer to bytes written when writing more than min size", () => {
      const encoder = BinaryEncoder.withDynamicSize({
        minimumSize: 4,
        builder(encoder) {
          encoder.chars("test");
          encoder.uint32(5);
          encoder.boolean(true);
        }
      });
      expect(encoder.byteLength).to.equal(9);
    });

    it("should crop the buffer to bytes written if no minimum size", () => {
      const encoder = BinaryEncoder.withDynamicSize(encoder => {
        encoder.chars("test");
        encoder.uint32(5);
        encoder.boolean(true);
      });
      expect(encoder.byteLength).to.equal(9);
    });

    it("should contain all of the data written in the function", () => {
      const encoder = BinaryEncoder.withDynamicSize(encoder => {
        encoder.chars("test");
        encoder.uint32(5);
        encoder.boolean(true);
      });
      expect(encoder.buffer.toString("utf-8", 0, 4)).to.equal("test");
      expect(encoder.buffer.readUInt32LE(4)).to.equal(5);
      expect(encoder.buffer.at(8)).to.equal(1);
    });

    it("should return the exact encoder object that was passed to the builder", () => {
      let generatedEncoder: BinaryEncoder | null = null;
      const encoder = BinaryEncoder.withDynamicSize(encoder => {
        generatedEncoder = encoder;
      });
      expect(encoder).to.equal(generatedEncoder);
    });

    // for more thorough behavior tests, see #withDynamicSize()
  });

  //#endregion

  //#region Text / Strings

  const charEncodings: readonly BufferEncoding[] = ["utf-8", "base64", "ascii"];

  describe("#chars()", () => {
    charEncodings.forEach(encoding => {
      it(`should encode the given chars (${encoding})`, () => {
        const byteLength = Buffer.byteLength("test", encoding);
        const encoder = BinaryEncoder.alloc(byteLength);
        encoder.chars("test", encoding);
        expect(encoder.buffer.toString(encoding)).to.equal("test");
      });
    });

    it("should write at the current offset", () => {
      const encoder = BinaryEncoder.alloc(6, 2);
      encoder.chars("test");
      expect(encoder.buffer.slice(2, 6).toString()).to.equal("test");
    });

    it("should advance the offset by the byte length of the given chars", () => {
      const encoder = BinaryEncoder.alloc(4);
      encoder.chars("test");
      expect(encoder.offset).to.equal(4);
    });

    it("should throw if going beyond buffer length", () => {
      const encoder = BinaryEncoder.alloc(3);
      expect(() => encoder.chars("test")).to.throw();
    });

    it("should support dynamic sizing in calls to withDynamicSize()", () => {
      BinaryEncoder.withDynamicSize({
        chunkSize: 2,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(2);
          encoder.chars("ABC");
          expect(encoder.byteLength).to.equal(4);
        }
      });
    });
  });

  describe("#terminatedString()", () => {
    charEncodings.forEach(encoding => {
      const byteLength = Buffer.byteLength("test", encoding);
      context(`character encoding = "${encoding}"`, () => {
        it("should encode the given string", () => {
          const encoder = BinaryEncoder.alloc(byteLength + 1);
          encoder.terminatedString("test", encoding);
          expect(encoder.buffer.toString(encoding, 0, byteLength)).to.equal("test");
        });

        it("should replace junk with a 0 for the null byte", () => {
          const buffer = Buffer.alloc(byteLength + 1);
          buffer.fill(0x12);
          const encoder = new BinaryEncoder(buffer);
          expect(encoder.buffer.at(byteLength)).to.equal(0x12);
          encoder.terminatedString("test", encoding);
          expect(encoder.buffer.at(byteLength)).to.equal(0);
        });

        it("should write at the current offset", () => {
          const encoder = BinaryEncoder.alloc(byteLength + 3, 2);
          encoder.terminatedString("test", encoding);
          expect(encoder.buffer.slice(2, byteLength + 2).toString(encoding)).to.equal("test");
        });

        it("should advance the offset by the byte length plus 1", () => {
          const encoder = BinaryEncoder.alloc(byteLength + 1);
          encoder.terminatedString("test", encoding);
          expect(encoder.offset).to.equal(byteLength + 1);
        });

        it("should throw if string goes beyond buffer length", () => {
          const encoder = BinaryEncoder.alloc(3);
          expect(() => encoder.terminatedString("test")).to.throw();
        });

        it("should throw if null terminator goes beyond buffer length", () => {
          const encoder = BinaryEncoder.alloc(4);
          expect(() => encoder.terminatedString("test")).to.throw();
        });

        it("should support dynamic sizing in calls to withDynamicSize()", () => {
          BinaryEncoder.withDynamicSize({
            chunkSize: 2,
            builder(encoder) {
              expect(encoder.byteLength).to.equal(2);
              encoder.chars("test", encoding);
              const expectedByteLength = byteLength % 2 ? byteLength + 1 : byteLength;
              expect(encoder.byteLength).to.equal(expectedByteLength);
            }
          });
        });
      });
    });
  });

  describe("[deprecated]#charsUtf8()", () => {
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

    it("should support dynamic sizing in calls to withDynamicSize()", () => {
      BinaryEncoder.withDynamicSize({
        chunkSize: 2,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(2);
          encoder.charsUtf8("ABC");
          expect(encoder.byteLength).to.equal(4);
        }
      });
    });
  });

  describe("[deprecated]#charsBase64()", () => {
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

    it("should support dynamic sizing in calls to withDynamicSize()", () => {
      BinaryEncoder.withDynamicSize({
        chunkSize: 2,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(2);
          encoder.charsBase64("test");
          const bytes = Buffer.byteLength("test", "base64");
          const expectedByteSize = bytes % 2 ? bytes + 1 : bytes;
          expect(encoder.byteLength).to.equal(expectedByteSize);
        }
      });
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

    it("should support dynamic sizing in calls to withDynamicSize()", () => {
      BinaryEncoder.withDynamicSize({
        chunkSize: 1,
        initialOffset: 1,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(1);
          encoder.boolean(true);
          expect(encoder.byteLength).to.equal(2);
        }
      });
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

    it("should support dynamic sizing in calls to withDynamicSize()", () => {
      BinaryEncoder.withDynamicSize({
        chunkSize: 2,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(2);
          encoder.bytes([1, 2, 3]);
          expect(encoder.byteLength).to.equal(4);
        }
      });
    });
  });

  describe("#null()", () => {
    it("should write the number of given null bytes", () => {
      const buffer = Buffer.from([1, 2, 3, 4]);
      const encoder = new BinaryEncoder(buffer);
      expect([...buffer]).to.deep.equal([1, 2, 3, 4]);
      encoder.null(3);
      expect([...buffer]).to.deep.equal([0, 0, 0, 4]);
    });

    it("should advance the offset by the number given", () => {
      const buffer = Buffer.from([1, 2, 3, 4]);
      const encoder = new BinaryEncoder(buffer);
      encoder.null(3);
      expect(encoder.offset).to.equal(3);
    });

    it("should write one null byte if arg omitted", () => {
      const buffer = Buffer.from([1, 2, 3, 4]);
      const encoder = new BinaryEncoder(buffer);
      expect([...buffer]).to.deep.equal([1, 2, 3, 4]);
      encoder.null();
      expect([...buffer]).to.deep.equal([0, 2, 3, 4]);
    });

    it("should advance the offset by 1 if arg omitted", () => {
      const buffer = Buffer.from([1, 2, 3, 4]);
      const encoder = new BinaryEncoder(buffer);
      encoder.null();
      expect(encoder.offset).to.equal(1);
    });

    it("should throw if going beyond buffer length", () => {
      const buffer = Buffer.from([1, 2, 3, 4]);
      const encoder = new BinaryEncoder(buffer);
      expect(() => encoder.null(5)).to.throw();
    });

    it("should support dynamic sizing in calls to withDynamicSize()", () => {
      BinaryEncoder.withDynamicSize({
        chunkSize: 2,
        builder(encoder) {
          expect(encoder.byteLength).to.equal(2);
          encoder.null(3);
          expect(encoder.byteLength).to.equal(4);
        }
      });
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

  //#region Dynamic Sizing

  describe("#withDynamicSize()", () => {
    context("argument handling", () => {
      it("should use the provided chunk size", () => {
        const encoder = BinaryEncoder.alloc(0);
        encoder.withDynamicSize(8, () => {
          expect(encoder.byteLength).to.equal(0);
          encoder.null();
          expect(encoder.byteLength).to.equal(8);
        });
      });

      it("should use a chunk size of 256 if not provided", () => {
        const encoder = BinaryEncoder.alloc(0);
        encoder.withDynamicSize(() => {
          expect(encoder.byteLength).to.equal(0);
          encoder.null();
          expect(encoder.byteLength).to.equal(256);
        });
      });

      it("should throw when chunk size is a float", () => {
        const encoder = BinaryEncoder.alloc(0);
        expect(() => encoder.withDynamicSize(1.5, () => { })).to.throw();
      });

      it("should throw when chunk size is 0", () => {
        const encoder = BinaryEncoder.alloc(0);
        expect(() => encoder.withDynamicSize(0, () => { })).to.throw();
      });

      it("should throw when chunk size is negative", () => {
        const encoder = BinaryEncoder.alloc(0);
        expect(() => encoder.withDynamicSize(-1, () => { })).to.throw();
      });

      it("should execute given function when passed alone", () => {
        const encoder = BinaryEncoder.alloc(0);
        let executed = false;
        encoder.withDynamicSize(() => {
          executed = true;
        });
        expect(executed).to.be.true;
      });

      it("should execute given function when passed with chunk size", () => {
        const encoder = BinaryEncoder.alloc(0);
        let executed = false;
        encoder.withDynamicSize(4, () => {
          executed = true;
        });
        expect(executed).to.be.true;
      });
    });

    context("before function execution", () => {
      it("should throw if dynamic resizing is already enabled", () => {
        const encoder = BinaryEncoder.alloc(0);
        encoder.withDynamicSize(() => {
          expect(() => encoder.withDynamicSize(() => { })).to.throw();
        });
      });

      it("should not change the buffer size initially", () => {
        const encoder = BinaryEncoder.alloc(0);
        encoder.withDynamicSize(() => {
          expect(encoder.byteLength).to.equal(0);
        });
      });
    });

    context("dynamic resizing", () => {
      context("seeking offset", () => {
        it("should not resize when seeking beyond byte length", () => {
          const encoder = BinaryEncoder.alloc(8);
          encoder.withDynamicSize(() => {
            encoder.seek(16);
            expect(encoder.byteLength).to.equal(8);
          });
        });

        it("should not resize when seeking beyond, seeking back, and writing", () => {
          const encoder = BinaryEncoder.alloc(8);
          encoder.withDynamicSize(() => {
            encoder.seek(16);
            encoder.seek(4);
            encoder.null();
            expect(encoder.byteLength).to.equal(8);
          });
        });
      });

      context("data can fit in current buffer", () => {
        it("should not resize when writing up to 2+ bytes before end", () => {
          const encoder = BinaryEncoder.alloc(6);
          encoder.withDynamicSize(() => {
            encoder.uint32(5);
            expect(encoder.byteLength).to.equal(6);
          });
        });

        it("should not resize when writing up to 1 byte before end", () => {
          const encoder = BinaryEncoder.alloc(5);
          encoder.withDynamicSize(() => {
            encoder.uint32(5);
            expect(encoder.byteLength).to.equal(5);
          });
        });

        it("should not resize when writing up to last byte", () => {
          const encoder = BinaryEncoder.alloc(4);
          encoder.withDynamicSize(() => {
            encoder.uint32(5);
            expect(encoder.byteLength).to.equal(4);
          });
        });
      });

      context("data cannot fit in current buffer", () => {
        it("should resize by 1 chunk when writing 1 byte past end", () => {
          const encoder = BinaryEncoder.alloc(3);
          encoder.withDynamicSize(4, () => {
            encoder.uint32(5);
            expect(encoder.byteLength).to.equal(7);
          });
        });

        it("should resize by 1 chunk when data requires chunk size - 1 byte", () => {
          const encoder = BinaryEncoder.alloc(4, 3);
          encoder.withDynamicSize(4, () => {
            encoder.uint32(5);
            expect(encoder.byteLength).to.equal(8);
          });
        });

        it("should resize by 1 chunk when data requires chunk size", () => {
          const encoder = BinaryEncoder.alloc(4, 4);
          encoder.withDynamicSize(4, () => {
            encoder.uint32(5);
            expect(encoder.byteLength).to.equal(8);
          });
        });

        it("should resize by 2 chunks when data requires chunk size + 1 byte", () => {
          const encoder = BinaryEncoder.alloc(4, 5);
          encoder.withDynamicSize(4, () => {
            encoder.uint32(5);
            expect(encoder.byteLength).to.equal(12);
          });
        });

        it("should resize by 2 chunks when data requires 2x chunk size - 1 byte", () => {
          const encoder = BinaryEncoder.alloc(4, 3);
          encoder.withDynamicSize(4, () => {
            encoder.uint64(5n);
            expect(encoder.byteLength).to.equal(12);
          });
        });

        it("should resize by 2 chunks when data requires 2x chunk size", () => {
          const encoder = BinaryEncoder.alloc(4, 4);
          encoder.withDynamicSize(4, () => {
            encoder.uint64(5n);
            expect(encoder.byteLength).to.equal(12);
          });
        });

        it("should resize by 3 chunks when data requires 2x chunk size + 1 byte", () => {
          const encoder = BinaryEncoder.alloc(4, 5);
          encoder.withDynamicSize(4, () => {
            encoder.uint64(5n);
            expect(encoder.byteLength).to.equal(16);
          });
        });
      });
    });

    context("after function execution", () => {
      it("should disable dynamic resizing", () => {
        const encoder = BinaryEncoder.alloc(0);
        encoder.withDynamicSize(4, () => {
          expect(encoder.hasClearance(4)).to.be.false;
          expect(() => encoder.uint32(5)).to.not.throw();
        });
        expect(encoder.hasClearance(4)).to.be.false;
        expect(() => encoder.uint32(5)).to.throw();
      });

      it("should not permanantly alter the default chunk size", () => {
        const encoder = BinaryEncoder.alloc(0);
        encoder.withDynamicSize(1, () => {
          encoder.null();
          expect(encoder.byteLength).to.equal(1);
        });
        encoder.withDynamicSize(() => {
          encoder.null();
          expect(encoder.byteLength).to.equal(257);
        });
      });

      it("should contain all of the data that was written", () => {
        const encoder = BinaryEncoder.alloc(0);
        encoder.withDynamicSize(() => {
          encoder.chars("test");
          encoder.uint32(5);
          encoder.boolean(true);
        });
        expect(encoder.buffer.toString("utf-8", 0, 4)).to.equal("test");
        expect(encoder.buffer.readUInt32LE(4)).to.equal(5);
        expect(encoder.buffer.at(8)).to.equal(1);
      });

      it("should not reduce the original size of the buffer, even if it wasn't used", () => {
        const encoder = BinaryEncoder.alloc(32);
        encoder.withDynamicSize(() => {
          encoder.uint32(4);
        });
        expect(encoder.byteLength).to.equal(32);
      });

      it("should not replace the buffer instance if never grew or cropped", () => {
        const originalBuffer = Buffer.alloc(4);
        const encoder = new BinaryEncoder(originalBuffer);
        encoder.withDynamicSize(() => {
          expect(encoder.byteLength).to.equal(4);
          encoder.uint32(5);
          expect(encoder.byteLength).to.equal(4); // did not grow
        });
        expect(encoder.byteLength).to.equal(4); // did not crop
        expect(originalBuffer).to.equal(encoder.buffer);
      });

      it("should replace the buffer instance if grew but not cropped", () => {
        const originalBuffer = Buffer.alloc(0);
        const encoder = new BinaryEncoder(originalBuffer);
        encoder.withDynamicSize(4, () => {
          expect(encoder.byteLength).to.equal(0);
          encoder.uint32(5);
          expect(encoder.byteLength).to.equal(4); // did grow
        });
        expect(encoder.byteLength).to.equal(4); // did not crop
        expect(originalBuffer).to.not.equal(encoder.buffer);
      });

      it("should replace the buffer instance if grew and cropped", () => {
        const originalBuffer = Buffer.alloc(0);
        const encoder = new BinaryEncoder(originalBuffer);
        encoder.withDynamicSize(4, () => {
          expect(encoder.byteLength).to.equal(0);
          encoder.uint16(5);
          expect(encoder.byteLength).to.equal(4); // did grow
        });
        expect(encoder.byteLength).to.equal(2); // did crop
        expect(originalBuffer).to.not.equal(encoder.buffer);
      });

      context("offset of furthest written byte == available byte length", () => {
        context("offset < byte length", () => {
          it("should not crop the buffer", () => {
            const encoder = BinaryEncoder.alloc(4);
            encoder.withDynamicSize(() => {
              encoder.uint32(5);
              encoder.seek(2)
              expect(encoder.byteLength).to.equal(4);
            });
            expect(encoder.byteLength).to.equal(4);
          });

          it("should not change the offset", () => {
            const encoder = BinaryEncoder.alloc(4);
            encoder.withDynamicSize(() => {
              encoder.uint32(5);
              encoder.seek(2)
              expect(encoder.offset).to.equal(2);
            });
            expect(encoder.offset).to.equal(2);
          });
        });

        context("offset == byte length", () => {
          it("should not crop the buffer", () => {
            const encoder = BinaryEncoder.alloc(4);
            encoder.withDynamicSize(() => {
              encoder.uint32(5);
              expect(encoder.byteLength).to.equal(4);
            });
            expect(encoder.byteLength).to.equal(4);
          });

          it("should not change the offset", () => {
            const encoder = BinaryEncoder.alloc(4);
            encoder.withDynamicSize(() => {
              encoder.uint32(5);
              expect(encoder.offset).to.equal(4);
            });
            expect(encoder.offset).to.equal(4);
          });
        });

        context("offset > byte length", () => {
          it("should not crop the buffer", () => {
            const encoder = BinaryEncoder.alloc(4);
            encoder.withDynamicSize(() => {
              encoder.uint32(5);
              encoder.skip(2);
              expect(encoder.byteLength).to.equal(4);
            });
            expect(encoder.byteLength).to.equal(4);
          });

          it("should set the offset to the byte length", () => {
            const encoder = BinaryEncoder.alloc(4);
            encoder.withDynamicSize(() => {
              encoder.uint32(5);
              encoder.skip(2);
              expect(encoder.offset).to.equal(6);
            });
            expect(encoder.offset).to.equal(4);
          });
        });
      });

      context("offset of furthest written byte < available byte length", () => {
        context("offset is < offset of furthest written byte", () => {
          it("should crop the buffer to the furthest written byte", () => {
            const encoder = BinaryEncoder.alloc(0);
            encoder.withDynamicSize(8, () => {
              encoder.uint32(5);
              encoder.seek(2);
              expect(encoder.byteLength).to.equal(8);
            });
            expect(encoder.byteLength).to.equal(4);
          });

          it("should not change the offset", () => {
            const encoder = BinaryEncoder.alloc(0);
            encoder.withDynamicSize(8, () => {
              encoder.uint32(5);
              encoder.seek(2);
              expect(encoder.offset).to.equal(2);
            });
            expect(encoder.offset).to.equal(2);
          });
        });

        context("offset is == offset of furthest written byte", () => {
          it("should crop the buffer to the furthest written byte", () => {
            const encoder = BinaryEncoder.alloc(0);
            encoder.withDynamicSize(8, () => {
              encoder.uint32(5);
              expect(encoder.byteLength).to.equal(8);
            });
            expect(encoder.byteLength).to.equal(4);
          });

          it("should not change the offset", () => {
            const encoder = BinaryEncoder.alloc(0);
            encoder.withDynamicSize(8, () => {
              encoder.uint32(5);
              expect(encoder.offset).to.equal(4);
            });
            expect(encoder.offset).to.equal(4);
          });
        });

        context("offset is > offset of furthest written byte", () => {
          it("should crop the buffer to the furthest written byte", () => {
            const encoder = BinaryEncoder.alloc(0);
            encoder.withDynamicSize(8, () => {
              encoder.uint32(5);
              encoder.skip(2);
              expect(encoder.byteLength).to.equal(8);
            });
            expect(encoder.byteLength).to.equal(4);
          });

          it("should set the offset to the offset of the furthest written byte", () => {
            const encoder = BinaryEncoder.alloc(0);
            encoder.withDynamicSize(8, () => {
              encoder.uint32(5);
              encoder.skip(2);
              expect(encoder.offset).to.equal(6);
            });
            expect(encoder.offset).to.equal(4);
          });
        });
      });
    });
  });

  //#endregion
});
