import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createPetImageStorage, detectImageType } from '../src/services/pet-images.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9]);
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00]);
const temporaryDirectories = [];

const temporaryStorage = async (maxBytes) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-images-'));
  temporaryDirectories.push(directory);
  return createPetImageStorage({ directory, maxBytes });
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('pet image storage', () => {
  it('detects complete supported image structures instead of trusting the MIME field', () => {
    expect(detectImageType(jpeg)).toMatchObject({ mimeType: 'image/jpeg', extension: '.jpg' });
    expect(detectImageType(png)).toMatchObject({ mimeType: 'image/png', extension: '.png' });
    expect(detectImageType(gif)).toMatchObject({ mimeType: 'image/gif', extension: '.gif' });
    expect(detectImageType(webp)).toMatchObject({ mimeType: 'image/webp', extension: '.webp' });
    expect(detectImageType(Buffer.from('not an image'))).toBeNull();
  });

  it('rejects truncated or corrupt payloads for every supported format', () => {
    expect(detectImageType(jpeg.subarray(0, -1))).toBeNull();
    expect(detectImageType(Buffer.concat([png.subarray(0, -12), Buffer.from([0])]))).toBeNull();
    expect(detectImageType(gif.subarray(0, -1))).toBeNull();
    expect(detectImageType(webp.subarray(0, -1))).toBeNull();
    const corruptPng = Buffer.from(png);
    corruptPng[corruptPng.length - 10] ^= 0xff;
    expect(detectImageType(corruptPng)).toBeNull();
  });

  it('writes safe random names, returns metadata, and removes only managed files', async () => {
    const storage = await temporaryStorage(1000);
    const saved = await storage.save({ buffer: png, originalname: '../../pet.js', mimetype: 'application/javascript' });
    expect(saved).toMatchObject({ imageUrl: expect.stringMatching(/^\/uploads\/pets\/[a-f0-9-]+\.png$/), imageMimeType: 'image/png', imageSizeBytes: png.length });
    const filename = path.basename(saved.imageUrl);
    expect(await fs.readFile(path.join(storage.directory, filename))).toEqual(png);
    expect(await storage.remove('/uploads/pets/../pet.js')).toBe(false);
    expect(await storage.remove(saved.imageUrl)).toBe(true);
    expect(await fs.stat(path.join(storage.directory, filename)).catch(() => null)).toBeNull();
  });

  it('reconciles only unreferenced generated files', async () => {
    const storage = await temporaryStorage(1000);
    const first = await storage.save({ buffer: png });
    const second = await storage.save({ buffer: gif });
    const result = await storage.reconcile([first.imageUrl]);
    expect(result).toMatchObject({ removed: 1, failed: [] });
    expect(await fs.stat(path.join(storage.directory, path.basename(first.imageUrl)))).toBeTruthy();
    await expect(fs.stat(path.join(storage.directory, path.basename(second.imageUrl)))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects invalid and oversized files without creating a file', async () => {
    const storage = await temporaryStorage(1000);
    await expect(storage.save({ buffer: Buffer.from('not an image') })).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
    const limitedStorage = await temporaryStorage(png.length - 1);
    await expect(limitedStorage.save({ buffer: png })).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE', status: 413 });
    expect((await fs.readdir(storage.directory).catch(() => []))).toHaveLength(0);
    expect((await fs.readdir(limitedStorage.directory).catch(() => []))).toHaveLength(0);
  });
});
