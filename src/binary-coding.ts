import { setImplementations } from "./lib/binary-coder-base";
import BinaryDecoder from "./lib/binary-decoder";
import BinaryEncoder from "./lib/binary-encoder";
import { Endianness } from "./lib/types";

setImplementations({
  decoderCls: BinaryDecoder,
  encoderCls: BinaryEncoder,
});

export {
  BinaryDecoder,
  BinaryEncoder,
  Endianness
};
