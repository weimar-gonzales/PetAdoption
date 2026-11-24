import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { AppError } from '../middleware/error-handler.js';
import { config } from '../config.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const UUID_FILENAME = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(?:jpg|png|gif|webp)$/i;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

const crc32 = (buffer) => {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

const isJpeg = (buffer) => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  let offset = 2;
  let hasFrame = false;
  while (offset < buffer.length) {
    if (buffer[offset++] !== 0xff) return false;
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === undefined || marker === 0x00 || marker === 0xd8) return false;
    if (marker === 0xd9) return hasFrame && offset === buffer.length;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) return false;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return false;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      if (segmentLength < 8 || buffer[offset + 2] !== 8 || buffer.readUInt16BE(offset + 3) === 0 || buffer.readUInt16BE(offset + 5) === 0) return false;
      hasFrame = true;
    }
    if (marker === 0xda) {
      if (!hasFrame || segmentLength < 2) return false;
      offset += segmentLength;
      while (offset < buffer.length) {
        if (buffer[offset++] !== 0xff) continue;
        while (buffer[offset] === 0xff) offset += 1;
        const scanByte = buffer[offset++];
        if (scanByte === 0x00 || (scanByte >= 0xd0 && scanByte <= 0xd7)) continue;
        return scanByte === 0xd9 && offset === buffer.length;
      }
      return false;
    }
    offset += segmentLength;
  }
  return false;
};

const pngChannels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const pngBitDepths = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

const isPng = (buffer, maxDecodedBytes = 64 * 1024 * 1024) => {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  let offset = 8;
  let header;
  let sawData = false;
  let sawEnd = false;
  const dataChunks = [];
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) return false;
    const length = buffer.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > buffer.length) return false;
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
    if (crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) !== expectedCrc) return false;
    if (type === 'IHDR') {
      if (header || length !== 13) return false;
      const width = data.readUInt32BE(0);
      const height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      if (!width || !height || !pngChannels[colorType] || !pngBitDepths[colorType]?.includes(bitDepth) || data[10] !== 0 || data[11] !== 0 || ![0, 1].includes(data[12])) return false;
      header = { width, height, bitDepth, colorType, interlace: data[12] };
    } else if (type === 'IDAT') {
      if (!header || sawEnd) return false;
      sawData = true;
      dataChunks.push(data);
    } else if (type === 'IEND') {
      if (!header || !sawData || length !== 0 || sawEnd) return false;
      sawEnd = true;
    }
    offset = chunkEnd;
    if (sawEnd && offset !== buffer.length) return false;
  }
  if (!header || !sawData || !sawEnd) return false;
  try {
    const decoded = inflateSync(Buffer.concat(dataChunks), { maxOutputLength: maxDecodedBytes });
    if (header.interlace === 0) {
      const bitsPerRow = header.width * pngChannels[header.colorType] * header.bitDepth;
      const expectedLength = header.height * (1 + Math.ceil(bitsPerRow / 8));
      if (!Number.isSafeInteger(expectedLength) || expectedLength !== decoded.length) return false;
    }
    return decoded.length > 0;
  } catch {
    return false;
  }
};

const skipGifSubBlocks = (buffer, start) => {
  let offset = start;
  while (offset < buffer.length) {
    const size = buffer[offset++];
    if (size === 0) return offset;
    if (offset + size > buffer.length) return -1;
    offset += size;
  }
  return -1;
};

const isGif = (buffer) => {
  if (buffer.length < 13 || !['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return false;
  if (!buffer.readUInt16LE(6) || !buffer.readUInt16LE(8)) return false;
  let offset = 13;
  const packed = buffer[10];
  if (packed & 0x80) offset += 3 * (2 ** ((packed & 0x07) + 1));
  if (offset > buffer.length) return false;
  let sawImage = false;
  while (offset < buffer.length) {
    const block = buffer[offset++];
    if (block === 0x3b) return sawImage && offset === buffer.length;
    if (block === 0x21) {
      if (offset >= buffer.length) return false;
      offset += 1;
      offset = skipGifSubBlocks(buffer, offset);
      if (offset < 0) return false;
      continue;
    }
    if (block !== 0x2c || offset + 9 > buffer.length) return false;
    if (!buffer.readUInt16LE(offset + 4) || !buffer.readUInt16LE(offset + 6)) return false;
    const imagePacked = buffer[offset + 8];
    offset += 9;
    if (imagePacked & 0x80) offset += 3 * (2 ** ((imagePacked & 0x07) + 1));
    if (offset >= buffer.length || buffer[offset++] < 2) return false;
    offset = skipGifSubBlocks(buffer, offset);
    if (offset < 0) return false;
    sawImage = true;
  }
  return false;
};

const isWebp = (buffer) => {
  if (buffer.length < 20 || buffer.subarray(0, 4).toString('ascii') !== 'RIFF' || buffer.subarray(8, 12).toString('ascii') !== 'WEBP' || buffer.readUInt32LE(4) + 8 !== buffer.length) return false;
  let offset = 12;
  let sawImage = false;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) return false;
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    const length = buffer.readUInt32LE(offset + 4);
    const chunkEnd = offset + 8 + length + (length % 2);
    if (chunkEnd > buffer.length) return false;
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'VP8 ' && length >= 10 && data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a) sawImage = true;
    if (type === 'VP8L' && length >= 5 && data[0] === 0x2f) sawImage = true;
    if (type === 'VP8X' && length >= 10 && data.readUIntLE(4, 3) > 0 && data.readUIntLE(7, 3) > 0) sawImage = true;
    offset = chunkEnd;
  }
  return sawImage && offset === buffer.length;
};

const imageTypes = [
  { mimeType: 'image/jpeg', extension: '.jpg', matches: isJpeg },
  { mimeType: 'image/png', extension: '.png', matches: isPng },
  { mimeType: 'image/gif', extension: '.gif', matches: isGif },
  { mimeType: 'image/webp', extension: '.webp', matches: isWebp },
];

export const detectImageType = (buffer) => imageTypes.find(({ matches }) => Buffer.isBuffer(buffer) && matches(buffer)) ?? null;

const invalidImage = (message = 'The uploaded file is not a supported image') => new AppError(400, 'INVALID_IMAGE', message);

const managedPath = (directory, imageUrl) => {
  if (typeof imageUrl !== 'string') return null;
  const prefix = '/uploads/pets/';
  if (!imageUrl.startsWith(prefix)) return null;
  const filename = imageUrl.slice(prefix.length);
  if (!UUID_FILENAME.test(filename)) return null;
  const resolved = path.resolve(directory, filename);
  return path.dirname(resolved) === path.resolve(directory) ? resolved : null;
};

export const createPetImageStorage = ({ directory = config.petImageDirectory, maxBytes = config.petImageMaxBytes } = {}) => {
  const root = path.resolve(directory);
  return {
    directory: root,

    async save(file) {
      if (!file) return null;
      if (!Buffer.isBuffer(file.buffer)) throw invalidImage();
      if (file.buffer.length > maxBytes) throw new AppError(413, 'IMAGE_TOO_LARGE', 'The image exceeds the maximum allowed size');
      const type = detectImageType(file.buffer);
      if (!type) throw invalidImage();
      await fs.mkdir(root, { recursive: true });
      const filename = `${crypto.randomUUID()}${type.extension}`;
      const target = path.join(root, filename);
      await fs.writeFile(target, file.buffer, { flag: 'wx', mode: 0o600 });
      return { imageUrl: `/uploads/pets/${filename}`, imageMimeType: type.mimeType, imageSizeBytes: file.buffer.length };
    },

    async remove(imageUrl) {
      const target = managedPath(root, imageUrl);
      if (!target) return false;
      try {
        await fs.unlink(target);
        return true;
      } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
    },

    async reconcile(referencedImageUrls = []) {
      const referenced = new Set(referencedImageUrls.map((imageUrl) => managedPath(root, imageUrl)).filter(Boolean).map((target) => path.basename(target)));
      const entries = await fs.readdir(root, { withFileTypes: true }).catch((error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
      let removed = 0;
      const failed = [];
      for (const entry of entries) {
        if (!entry.isFile() || !UUID_FILENAME.test(entry.name) || referenced.has(entry.name)) continue;
        try {
          await fs.unlink(path.join(root, entry.name));
          removed += 1;
        } catch (error) {
          failed.push({ filename: entry.name, error });
        }
      }
      return { removed, failed };
    },
  };
};

export const imageUploadField = 'image';
export const supportedImageMimeTypes = imageTypes.map(({ mimeType }) => mimeType);
export const maxPetImageBytes = config.petImageMaxBytes;

export const assertSupportedImage = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer) || !detectImageType(file.buffer)) throw invalidImage();
};
