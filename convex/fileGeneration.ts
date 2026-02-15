// File Generation Utilities for Convex
// Generates test files for File Provider API simulation

/**
 * Generate a valid PNG file with random pixel data
 * Target size: exactly 5MB (5,242,880 bytes)
 * Image dimensions: 2000x2000 pixels, RGBA format
 */
export function generateTestPNG(): Uint8Array {
  // PNG file structure constants
  const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const TARGET_SIZE = 5 * 1024 * 1024; // 5MB exactly
  const WIDTH = 2000;
  const HEIGHT = 2000;
  const BIT_DEPTH = 8;
  const COLOR_TYPE = 6; // RGBA (true color with alpha)

  // Calculate sizes
  const SIGNATURE_SIZE = 8;
  const IHDR_CHUNK_SIZE = 25; // 4 (length) + 4 (type) + 13 (data) + 4 (CRC)
  const IEND_CHUNK_SIZE = 12; // 4 (length) + 4 (type) + 0 (data) + 4 (CRC)
  const OVERHEAD = SIGNATURE_SIZE + IHDR_CHUNK_SIZE + IEND_CHUNK_SIZE;

  // Calculate how much space we have for pixel data
  const AVAILABLE_FOR_DATA = TARGET_SIZE - OVERHEAD;

  // Build the PNG file
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  // 1. PNG Signature
  chunks.push(PNG_SIGNATURE);
  totalSize += PNG_SIGNATURE.length;

  // 2. IHDR Chunk (Image Header)
  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);

  ihdrView.setUint32(0, WIDTH, false); // Width
  ihdrView.setUint32(4, HEIGHT, false); // Height
  ihdrData[8] = BIT_DEPTH; // Bit depth
  ihdrData[9] = COLOR_TYPE; // Color type (RGBA)
  ihdrData[10] = 0; // Compression method (deflate)
  ihdrData[11] = 0; // Filter method (adaptive)
  ihdrData[12] = 0; // Interlace method (none)

  const ihdrChunk = createPNGChunk('IHDR', ihdrData);
  chunks.push(ihdrChunk);
  totalSize += ihdrChunk.length;

  // 3. IDAT Chunk (Image Data)
  // Fill remaining space with random data
  const idatDataSize = AVAILABLE_FOR_DATA - 8; // 8 bytes for chunk header/crc
  const idatData = new Uint8Array(idatDataSize);

  // Generate random data using Web Crypto API (available in Convex)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Fill in chunks of 65536 bytes (max for getRandomValues)
    const chunkSize = 65536;
    for (let i = 0; i < idatData.length; i += chunkSize) {
      const size = Math.min(chunkSize, idatData.length - i);
      const chunk = new Uint8Array(size);
      crypto.getRandomValues(chunk);
      idatData.set(chunk, i);
    }
  } else {
    // Fallback: use Math.random (less secure but works)
    for (let i = 0; i < idatData.length; i++) {
      idatData[i] = Math.floor(Math.random() * 256);
    }
  }

  const idatChunk = createPNGChunk('IDAT', idatData);
  chunks.push(idatChunk);
  totalSize += idatChunk.length;

  // 4. IEND Chunk (End marker)
  const iendChunk = createPNGChunk('IEND', new Uint8Array(0));
  chunks.push(iendChunk);
  totalSize += iendChunk.length;

  // Combine all chunks into single array
  const pngFile = new Uint8Array(totalSize);
  let offset = 0;

  for (const chunk of chunks) {
    pngFile.set(chunk, offset);
    offset += chunk.length;
  }

  console.log(`Generated PNG: ${pngFile.length} bytes (target: ${TARGET_SIZE})`);

  return pngFile;
}

/**
 * Create a PNG chunk with proper structure
 * Format: [length:4] [type:4] [data:length] [crc:4]
 */
function createPNGChunk(type: string, data: Uint8Array): Uint8Array {
  const length = data.length;
  const chunk = new Uint8Array(4 + 4 + length + 4);
  const view = new DataView(chunk.buffer);

  // Write length (big-endian)
  view.setUint32(0, length, false);

  // Write chunk type (4 ASCII characters)
  const typeBytes = new TextEncoder().encode(type);
  chunk.set(typeBytes, 4);

  // Write data
  chunk.set(data, 8);

  // Calculate and write CRC32
  const crc = calculateCRC32(chunk.slice(4, 4 + 4 + length));
  view.setUint32(4 + 4 + length, crc, false);

  return chunk;
}

/**
 * Calculate CRC32 checksum for PNG chunks
 * Uses standard CRC-32 algorithm with PNG polynomial
 */
function calculateCRC32(data: Uint8Array): number {
  // CRC-32 lookup table (precomputed for PNG polynomial 0xEDB88320)
  const crcTable = makeCRCTable();

  let crc = 0xFFFFFFFF;

  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    const tableIndex = (crc ^ byte) & 0xFF;
    crc = crcTable[tableIndex] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Generate CRC32 lookup table for PNG
 */
function makeCRCTable(): Uint32Array {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xEDB88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c >>> 0;
  }

  return table;
}

/**
 * Convert Uint8Array to base64 string
 * Useful for transferring binary data over HTTP
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 * Useful for receiving binary data over HTTP
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
