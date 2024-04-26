# Binary Coding

Zero-dependency utilities for reading/writing binary data in JavaScript.

**Notes**
- This package is for Node, but is compatible with [browserify](https://www.npmjs.com/package/browserify).
- This package is a replacement for [@s4tk/encoding](https://www.npmjs.com/package/@s4tk/encoding), and is completely backwards compatible with it (some methods are deprecated, but still work, so you just have to swap out imports).

## Overview

Instead of this:
```ts
// Encoding
let offset = 0;
const buffer = Buffer.alloc(size);
buffer.write(header, offset, 4);
offset += 4;
buffer.writeUInt16LE(version, offset);
offset += 2;

// Decoding
let offset = 0;
const header = buffer.toString("utf-8", offset, 4);
offset += 4;
const version = buffer.readUInt16LE(offset);
offset += 2;
```

Do this:
```ts
// Encoding
const encoder = BinaryEncoder.alloc(size);
encoder.chars(header);
encoder.uint16(version);

// Decoding
const decoder = new BinaryDecoder(buffer);
const header = decoder.chars(4);
const version = decoder.uint16();
```

**Quick Facts**
- All the primitives you'd expect are supported: bytes, bools, chars, signed/unsigned 8/16/32/64-bit ints, floats, and doubles (as well as some other handy types, like null-terminated strings).
- Both little and big endianness are supported, and you can switch between them.
- The encoder/decoder automatically track the offset, but it can be manually set if needed.
- The encoder supports dynamically growing as values are written, if needed.

## Usage

### Installation

This package is available on npm:
```console
npm i binary-coding
```

### Importing

Both ES modules and CommonJS are supported:
```ts
import { BinaryEncoder, BinaryDecoder } from "binary-coding";
```
```js
const { BinaryEncoder, BinaryDecoder } = require("binary-coding");
```

### Decoding Data

To decode data in a buffer, create a `BinaryDecoder`:
```ts
// by default, it uses little endian - but this can be configured
const decoder = new BinaryDecoder(buffer);
```

Once you have the decoder, simply call its methods:
```ts
const header = decoder.chars(4);
const version = decoder.uint16();
decoder.skip(2); // skip over some unneeded metadata
const numEntries = decoder.uint32();
const entries = decoder.iterate(numEntries, () => {
  const hash = decoder.uint64();
  const value = decoder.terminatedString();
  return { hash, value };
});
```

### Encoding Data

There are multiple ways to create a `BinaryEncoder`:
- Its constructor.
- The static `alloc()` method.
- The static `dynamicallySized()` method.

When performance is critical, it is highly recommended to pre-calculate the total length of the buffer and create the encoder using that size, such as:
```ts
const encoder = new BinaryEncoder(Buffer.alloc(size));
```

Or, for short:
```ts
const encoder = BinaryEncoder.alloc(size);
```

When performance isn't as important as ease of writing code, the encoder can figure its size out as you write to it:
```ts
const encoder = BinaryEncoder.dynamicallySized(encoder => {
  // write your data here
});
```

However you choose to create your encoder, you can write data just as simply as reading it:
```ts
encoder.chars(header);
encoder.uint16(version);
encoder.null(2); // make the metadata blank
encoder.uint32(entries.length);
entries.forEach(({ hash, value }) => {
  encoder.uint64(hash);
  encoder.terminatedString(value);
});
```

Finally, when it's time to get your encoded buffer, just access the buffer property:
```ts
const buffer = encoder.buffer;
```
