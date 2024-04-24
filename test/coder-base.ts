import { expect } from "chai";
import { BinaryEncoder, BinaryDecoder } from "../dst/binary-coding";
import { BinaryCoderMethodArgs } from "./types";

export function describeBinaryCoderMethods(args: BinaryCoderMethodArgs) {
  describe("#getDecoder()", () => {
    it("should return a new decoder instance", () => {
      const coder = args.createCoder(5);
      const decoder = coder.getDecoder();
      expect(decoder).to.be.an.instanceOf(BinaryDecoder);
    });

    it("should use the same buffer in this coder", () => {
      const coder = args.createCoder(5);
      const decoder = coder.getDecoder();
      expect(coder.buffer).to.equal(decoder.buffer);
    });

    it("should use the given initial offset", () => {
      const coder = args.createCoder(5);
      const decoder = coder.getDecoder(3);
      expect(decoder.offset).to.equal(3);
    });

    it("should use the given endianness (LE)", () => {
      const coder = args.createCoder(5);
      const decoder = coder.getDecoder(0, "LE");
      expect(decoder.endianness).to.equal("LE");
    });

    it("should use the given endianness (BE)", () => {
      const coder = args.createCoder(5);
      const decoder = coder.getDecoder(0, "BE");
      expect(decoder.endianness).to.equal("BE");
    });

    it("should use offset of 0 by default", () => {
      const coder = args.createCoder(5);
      const decoder = coder.getDecoder();
      expect(decoder.offset).to.equal(0);
    });

    it("should use little endian by default", () => {
      const coder = args.createCoder(5);
      const decoder = coder.getDecoder();
      expect(decoder.endianness).to.equal("LE");
    });
  });

  describe("#getEncoder()", () => {
    it("should return a new coder instance", () => {
      const coder = args.createCoder(5);
      const copy = coder.getEncoder();
      expect(copy).to.be.an.instanceOf(BinaryEncoder);
      expect(coder).to.not.equal(copy);
    });

    it("should use the same buffer in this coder", () => {
      const coder = args.createCoder(5);
      const copy = coder.getEncoder();
      expect(coder.buffer).to.equal(copy.buffer);
    });

    it("should use the given initial offset", () => {
      const coder = args.createCoder(5);
      const copy = coder.getEncoder(3);
      expect(copy.offset).to.equal(3);
    });

    it("should use the given endianness (LE)", () => {
      const coder = args.createCoder(5);
      const copy = coder.getEncoder(0, "LE");
      expect(copy.endianness).to.equal("LE");
    });

    it("should use the given endianness (BE)", () => {
      const coder = args.createCoder(5);
      const copy = coder.getEncoder(0, "BE");
      expect(copy.endianness).to.equal("BE");
    });

    it("should use offset of 0 by default", () => {
      const coder = args.createCoder(5);
      const copy = coder.getEncoder();
      expect(copy.offset).to.equal(0);
    });

    it("should use little endian by default", () => {
      const coder = args.createCoder(5);
      const copy = coder.getEncoder();
      expect(copy.endianness).to.equal("LE");
    });
  });

  describe("#isEOF()", () => {
    it("should return false at offset < 0", () => {
      const coder = args.createCoder(5, -1);
      expect(coder.isEOF()).to.be.false;
    });

    it("should return false at offset within range of buffer", () => {
      const coder = args.createCoder(5, 2);
      expect(coder.isEOF()).to.be.false;
    });

    it("should return false at offset of final byte of buffer", () => {
      const coder = args.createCoder(5, 4);
      expect(coder.isEOF()).to.be.false;
    });

    it("should return true at offset of buffer length", () => {
      const coder = args.createCoder(5, 5);
      expect(coder.isEOF()).to.be.true;
    });

    it("should return true at offset beyond buffer length", () => {
      const coder = args.createCoder(5, 6);
      expect(coder.isEOF()).to.be.true;
    });
  });

  describe("#iterate()", () => {
    it("should iterate n times", () => {
      const coder = args.createCoder(5);
      let iters = 0;
      coder.iterate(3, () => {
        ++iters;
      });
      expect(iters).to.equal(3);
    });

    it("should not iterate if n is 0", () => {
      const coder = args.createCoder(5);
      let iters = 0;
      coder.iterate(0, () => {
        ++iters;
      });
      expect(iters).to.equal(0);
    });

    it("should throw if n is negative", () => {
      const coder = args.createCoder(5);
      expect(() => coder.iterate(-1, () => { })).to.throw();
    });

    it("should pass the index to each function call", () => {
      const coder = args.createCoder(5);
      let index = 0;
      coder.iterate(3, (i) => {
        expect(i).to.equal(index);
        ++index;
      });
    });

    it("should return a list containing result of each iteration", () => {
      const coder = args.createCoder(5);
      const list = coder.iterate(3, (i) => i);
      expect(list).to.be.an("Array")
        .with.lengthOf(3)
        .and.deep.equals([0, 1, 2]);
    });
  });

  describe("#savePos()", () => {
    it("should execute the given function", () => {
      const coder = args.createCoder(5);
      let fnRun = false;
      coder.savePos(() => {
        fnRun = true;
      });
      expect(fnRun).to.be.true;
    });

    it("should not change the offset before the function runs", () => {
      const coder = args.createCoder(5, 2);
      let offsetAtStart = -1;
      coder.savePos(() => {
        offsetAtStart = coder.offset;
        coder.byte(0);
      });
      expect(offsetAtStart).to.equal(2);
    });

    it("should reset the offset to where it was after the function runs", () => {
      const coder = args.createCoder(5, 2);
      coder.savePos(() => {
        coder.byte(0);
      });
      expect(coder.offset).to.equal(2);
    });
  });

  describe("#seek()", () => {
    it("should set the offset to the given number (< current)", () => {
      const coder = args.createCoder(5, 4);
      expect(coder.offset).to.equal(4);
      coder.seek(2)
      expect(coder.offset).to.equal(2);
    });

    it("should set the offset to the given number (> current)", () => {
      const coder = args.createCoder(5, 2);
      expect(coder.offset).to.equal(2);
      coder.seek(4)
      expect(coder.offset).to.equal(4);
    });

    it("should not change the offset when given the current offset", () => {
      const coder = args.createCoder(5, 2);
      expect(coder.offset).to.equal(2);
      coder.seek(2)
      expect(coder.offset).to.equal(2);
    });
  });

  describe("#skip()", () => {
    it("should advance the offset by the given number", () => {
      const coder = args.createCoder(5);
      expect(coder.offset).to.equal(0);
      coder.skip(2)
      expect(coder.offset).to.equal(2);
      coder.skip(2)
      expect(coder.offset).to.equal(4);
    });
  });

  describe("#tell()", () => {
    it("should return the given offset", () => {
      const coder = args.createCoder(5);
      expect(coder.tell()).to.equal(0);
      coder.skip(1);
      expect(coder.tell()).to.equal(1);
      coder.seek(3);
      expect(coder.tell()).to.equal(3);
    });
  });
}
