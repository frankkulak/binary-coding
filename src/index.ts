import { setImplementations } from "./lib/binary-coder-base";
import BinaryDecoder from "./lib/binary-decoder";
import BinaryEncoder, {
  DynamicSizeBuilder,
  DynamicSizeBuilderWithOptions,
} from "./lib/binary-encoder";
import {
  DecoderBitMaskings,
  EncoderBitMaskings
} from "./lib/bit-masking";
import { Endianness } from "./lib/types";

setImplementations({
  decoderCls: BinaryDecoder,
  encoderCls: BinaryEncoder,
});

export {
  BinaryDecoder,
  BinaryEncoder,
  DecoderBitMaskings,
  DynamicSizeBuilder,
  DynamicSizeBuilderWithOptions,
  EncoderBitMaskings,
  Endianness
};
