import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createPetImageStorage } from '../src/services/pet-images.js';

const managementApiKey = 'upload-test-key';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
const directories = [];

const repositories = () => {
  const pets = [];
  const users = [];
  const sessions = new Map();
  return {
    petRepository: {
      list: async () => ({ data: pets, total: pets.length, page: 1, pageSize: 20 }),
      findById: async (id) => pets.find((pet) => pet.id === id) ?? null,
      create: async (input) => { const pet = { id: 1, ...input }; pets.push(pet); return pet; },
      update: async (id, input) => { const pet = pets.find((value) => value.id === id); if (!pet) return null; Object.assign(pet, input); return pet; },
      remove: async (id) => { const index = pets.findIndex((pet) => pet.id === id); if (index < 0) return false; pets.splice(index, 1); return true; },
    },
    userRepository: {
      findByEmail: async (email) => users.find((user) => user.email === email) ?? null,
      findById: async (id) => users.find((user) => user.id === id) ?? null,
      create: async (input) => { const user = { id: 1, email: input.email, name: input.name, phone: null, address: null, passwordHash: input.passwordHash }; users.push(user); return user; },
      update: async (id, input) => { const user = users.find((value) => value.id === id); Object.assign(user, input); const { passwordHash, ...safe } = user; void passwordHash; return safe; },
    },
    sessionRepository: {
      create: async (userId) => { const token = `upload-session-${userId}`; sessions.set(token, userId); return { token, expiresAt: new Date(Date.now() + 10000) }; },
      findUserByToken: async (token) => { const userId = sessions.get(token); return users.find((user) => user.id === userId) ?? null; },
      revoke: async (token) => sessions.delete(token),
    },
    adoptionRequestRepository: { list: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }) },
  };
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('pet image API', () => {
  it('accepts detected image bytes, persists metadata, and serves the safe URL', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-upload-api-'));
    directories.push(directory);
    const imageStorage = createPetImageStorage({ directory });
    const app = createApp({ ...repositories(), managementApiKey, imageStorage });
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Owner', email: 'owner-upload@example.com', password: 'password-123' }).expect(201);

    const response = await agent.post('/api/pets')
      .field('name', 'Pip').field('species', 'rabbit').field('breed', 'Lionhead').field('age', '1')
      .field('gender', 'female').field('size', 'small').field('description', 'Calm rabbit')
      .attach('image', png, { filename: '../../pet.exe', contentType: 'application/x-msdownload' })
      .expect(201);

    expect(response.body.pet).toMatchObject({ imageMimeType: 'image/png', imageSizeBytes: png.length, imageUrl: expect.stringMatching(/^\/uploads\/pets\/[a-f0-9-]+\.png$/) });
    const served = await request(app).get(response.body.pet.imageUrl).expect(200);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.body).toEqual(png);
    await request(app).get('/uploads/pets/%2e%2e%2fsecret.txt').expect(404);
  });

  it('keeps unauthenticated and invalid uploads out of storage', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-upload-api-'));
    directories.push(directory);
    const imageStorage = createPetImageStorage({ directory });
    const app = createApp({ ...repositories(), managementApiKey, imageStorage });
    await request(app).post('/api/pets').attach('image', png, { filename: 'pet.png' }).expect(401);
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Owner', email: 'invalid-upload@example.com', password: 'password-123' }).expect(201);
    const invalid = await agent.post('/api/pets').field('name', 'Pip').field('species', 'rabbit').field('breed', 'Lionhead').field('age', '1').field('gender', 'female').field('size', 'small').field('description', 'Calm rabbit').attach('image', Buffer.from('not an image'), { filename: 'pet.png' }).expect(400);
    expect(invalid.body.error.code).toBe('INVALID_IMAGE');
    const corrupt = Buffer.from(png);
    corrupt[corrupt.length - 10] ^= 0xff;
    const malformed = await agent.post('/api/pets').field('name', 'Pip').field('species', 'rabbit').field('breed', 'Lionhead').field('age', '1').field('gender', 'female').field('size', 'small').field('description', 'Calm rabbit').attach('image', corrupt, { filename: 'pet.png' }).expect(400);
    expect(malformed.body.error.code).toBe('INVALID_IMAGE');
    const oversized = await agent.post('/api/pets').field('name', 'Pip').field('species', 'rabbit').field('breed', 'Lionhead').field('age', '1').field('gender', 'female').field('size', 'small').field('description', 'Calm rabbit').attach('image', Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]), { filename: 'pet.png' }).expect(413);
    expect(oversized.body.error.code).toBe('IMAGE_TOO_LARGE');
    expect(await fs.readdir(directory)).toHaveLength(0);
  });

  it('accepts every supported format through the multipart endpoint', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-upload-api-'));
    directories.push(directory);
    const imageStorage = createPetImageStorage({ directory });
    const app = createApp({ ...repositories(), managementApiKey, imageStorage });
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Owner', email: 'format-upload@example.com', password: 'password-123' }).expect(201);
    const fixtures = [[png, 'png', 'image/jpeg'], [gif, 'gif', 'application/octet-stream']];
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9]);
    const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00]);
    fixtures.push([jpeg, 'jpg', 'image/png'], [webp, 'webp', 'image/jpeg']);
    for (const [buffer, extension, contentType] of fixtures) {
      const response = await agent.post('/api/pets').field('name', `Pip-${extension}`).field('species', 'rabbit').field('breed', 'Lionhead').field('age', '1').field('gender', 'female').field('size', 'small').field('description', 'Calm rabbit').attach('image', buffer, { filename: `pet.${extension}`, contentType }).expect(201);
      expect(response.body.pet.imageMimeType).toBe(`image/${extension === 'jpg' ? 'jpeg' : extension}`);
    }
  });

  it('supports multipart PATCH and PUT while replacing and deleting managed files', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-upload-api-'));
    directories.push(directory);
    const imageStorage = createPetImageStorage({ directory });
    const app = createApp({ ...repositories(), managementApiKey, imageStorage });
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Owner', email: 'lifecycle-upload@example.com', password: 'password-123' }).expect(201);
    const created = await agent.post('/api/pets').field('name', 'Pip').field('species', 'rabbit').field('breed', 'Lionhead').field('age', '1').field('gender', 'female').field('size', 'small').field('description', 'Calm rabbit').attach('image', png, { filename: 'pet.png' }).expect(201);
    const oldUrl = created.body.pet.imageUrl;
    const patched = await agent.patch(`/api/pets/${created.body.pet.id}`).field('description', 'Updated rabbit').attach('image', gif, { filename: 'pet.gif' }).expect(200);
    expect(patched.body.pet.imageMimeType).toBe('image/gif');
    await expect(fs.stat(path.join(directory, path.basename(oldUrl)))).rejects.toMatchObject({ code: 'ENOENT' });
    await agent.put(`/api/pets/${created.body.pet.id}`).field('description', 'Put rabbit').expect(200);
    await agent.delete(`/api/pets/${created.body.pet.id}`).expect(200);
    await expect(fs.stat(path.join(directory, path.basename(patched.body.pet.imageUrl)))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('observes cleanup failures without deleting an unrelated path', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-upload-api-'));
    directories.push(directory);
    const actualStorage = createPetImageStorage({ directory });
    const imageStorage = { ...actualStorage, remove: vi.fn().mockRejectedValue(new Error('disk unavailable')) };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const app = createApp({ ...repositories(), managementApiKey, imageStorage });
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ name: 'Owner', email: 'cleanup-upload@example.com', password: 'password-123' }).expect(201);
      const created = await agent.post('/api/pets').field('name', 'Pip').field('species', 'rabbit').field('breed', 'Lionhead').field('age', '1').field('gender', 'female').field('size', 'small').field('description', 'Calm rabbit').attach('image', png, { filename: 'pet.png' }).expect(201);
      await agent.delete(`/api/pets/${created.body.pet.id}`).expect(200);
      expect(errorSpy).toHaveBeenCalledWith('Pet image cleanup failed', expect.objectContaining({ imageUrl: created.body.pet.imageUrl }));
      expect(await fs.stat(path.join(directory, path.basename(created.body.pet.imageUrl)))).toBeTruthy();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
