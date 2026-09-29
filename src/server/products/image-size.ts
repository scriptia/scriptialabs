// Image dimensions straight from the header bytes, for PNG and baseline or
// progressive JPEG — the two formats mzstatic serves. No image library, for the
// same reason as the runner upload route: a header read is all that is needed.

/** Reads width/height from a PNG's IHDR or a JPEG's first SOF marker. Null when neither parses. */
export function readImageSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.toString('ascii', 12, 16) === 'IHDR') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      // SOF0..SOF15, minus DHT (C4), JPG (C8) and DAC (CC), which share the range.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}
