import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const MANAGEMENT_API_KEY = 'test-management-key';

const pet = (id, overrides = {}) => ({
  id,
  ownerUserId: null,
  name: 'Luna',
  species: 'dog',
  breed: 'Labrador mix',
  age: 3,
  gender: 'female',
  size: 'large',
  description: 'Friendly dog',
  imageUrl: null,
  status: 'available',
  ...overrides,
});

const account = (id, overrides = {}) => ({
  id,
  email: `user${id}@example.com`,
  name: `User ${id}`,
  phone: null,
  address: null,
  ...overrides,
});

const createRepositories = () => {
  const pets = [pet(1), pet(2, { name: 'Milo', species: 'cat', breed: 'Domestic shorthair', size: 'small' })];
  const users = [];
  const sessions = new Map();
  const requests = [];
  let nextPetId = 3;
  let nextUserId = 1;
  let nextRequestId = 1;
  return {
    petRepository: {
      list: async (filters) => {
        let result = pets.filter((value) => !filters.species || value.species === filters.species);
        if (filters.search) result = result.filter((value) => `${value.name} ${value.breed}`.toLowerCase().includes(filters.search.toLowerCase()));
        return { data: result, total: result.length, page: filters.page, pageSize: filters.pageSize };
      },
      findById: async (id) => pets.find((value) => value.id === id) ?? null,
      create: async (input) => { const value = pet(nextPetId++, input); pets.push(value); return value; },
      update: async (id, input) => { const value = pets.find((item) => item.id === id); if (!value) return null; Object.assign(value, input); return value; },
      remove: async (id) => { const index = pets.findIndex((value) => value.id === id); if (index < 0) return false; pets.splice(index, 1); return true; },
    },
    userRepository: {
      findByEmail: async (email) => users.find((value) => value.email === email) ?? null,
      findById: async (id) => users.find((value) => value.id === id) ?? null,
      create: async (input) => { const value = account(nextUserId++, input); delete value.passwordHash; users.push({ ...value, passwordHash: input.passwordHash }); return value; },
      update: async (id, input) => { const value = users.find((item) => item.id === id); if (!value) return null; Object.assign(value, input); const { passwordHash, ...safe } = value; void passwordHash; return safe; },
    },
    sessionRepository: {
      create: async (userId) => { const token = `session-${userId}-${sessions.size + 1}`; sessions.set(token, userId); return { token, expiresAt: new Date(Date.now() + 10000) }; },
      findUserByToken: async (token) => { const id = sessions.get(token); if (!id) return null; return users.find((value) => value.id === id) ?? null; },
      revoke: async (token) => sessions.delete(token),
    },
    adoptionRequestRepository: {
      list: async (filters) => {
        const result = requests.filter((value) => (!filters.status || value.status === filters.status) && (!filters.petId || value.petId === filters.petId) && (!filters.userId || value.userId === filters.userId));
        return { data: result, total: result.length, page: filters.page, pageSize: filters.pageSize };
      },
      findById: async (id) => requests.find((value) => value.id === id) ?? null,
      create: async (input) => {
        const target = pets.find((value) => value.id === input.petId);
        if (!target) { const error = new Error('missing'); error.code = 'ER_NO_REFERENCED_ROW_2'; throw error; }
        if (target.status !== 'available') { const error = new Error('unavailable'); error.status = 409; error.code = 'PET_UNAVAILABLE'; throw error; }
        target.status = 'pending';
        const value = { id: nextRequestId++, status: 'pending', ...input };
        requests.push(value);
        return value;
      },
      update: async (id, input) => {
        const value = requests.find((item) => item.id === id);
        if (!value) return null;
        const target = pets.find((item) => item.id === value.petId);
        if (value.status === 'pending' && input.status === 'approved') target.status = 'adopted';
        if (value.status === 'pending' && input.status === 'rejected') target.status = 'available';
        Object.assign(value, input);
        return value;
      },
      remove: async (id) => { const index = requests.findIndex((value) => value.id === id); if (index < 0) return false; requests.splice(index, 1); return true; },
    },
  };
};

const setup = ({ imageStorage } = {}) => {
  const repositories = createRepositories();
  return { app: createApp({ ...repositories, managementApiKey: MANAGEMENT_API_KEY, imageStorage }), repositories };
};

const register = (app, input = {}) => request(app).post('/api/auth/register').send({
  name: 'Alex Doe', email: 'alex@example.com', password: 'password-123', ...input,
});

describe('pet adoption API', () => {
  it('returns health and public pets without a database', async () => {
    const { app } = setup();
    await request(app).get('/api/health').expect(200, { status: 'ok' });
    const response = await request(app).get('/api/pets?species=cat&page=2&pageSize=5').expect(200);
    expect(response.body.pets).toHaveLength(1);
  });

  it('registers, logs in, reads and updates a profile, then logs out', async () => {
    const { app } = setup();
    const registered = await register(app).expect(201);
    expect(registered.body.user).not.toHaveProperty('passwordHash');
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'alex@example.com', password: 'password-123' }).expect(200);
    await agent.get('/api/auth/me').expect(200);
    await agent.patch('/api/profile').send({ name: 'Alex Updated' }).expect(200);
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });

  it('rejects duplicate and invalid authentication safely', async () => {
    const { app } = setup();
    await register(app);
    const duplicate = await register(app);
    expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    const invalid = await request(app).post('/api/auth/login').send({ email: 'alex@example.com', password: 'wrong-pass' }).expect(401);
    expect(invalid.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(invalid.body).not.toHaveProperty('passwordHash');
    await request(app).patch('/api/profile').send({ name: 'Nope' }).expect(401);
  });

  it('requires authenticated owners for pet creation and management', async () => {
    const { app } = setup();
    await request(app).post('/api/pets').send({ name: 'Pip' }).expect(401);
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Owner', email: 'owner@example.com', password: 'password-123' }).expect(201);
    const created = await agent.post('/api/pets').send({ name: 'Pip', species: 'rabbit', breed: 'Lionhead', age: 1, gender: 'female', size: 'small', description: 'Calm rabbit' }).expect(201);
    await request(app).patch(`/api/pets/${created.body.pet.id}`).send({ name: 'Nope' }).expect(403);
    await request(app).patch(`/api/pets/${created.body.pet.id}`).set('x-api-key', MANAGEMENT_API_KEY).send({ status: 'pending' }).expect(200);
  });

  it('requires authenticated users to create and list only their adoption requests', async () => {
    const { app } = setup();
    await request(app).post('/api/adoption-requests').send({ petId: 1, applicantName: 'Alex Doe', email: 'alex@example.com', phone: '555-5555', message: 'Please' }).expect(401);
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Applicant', email: 'applicant@example.com', password: 'password-123', phone: '555-5555' }).expect(201);
    const created = await agent.post('/api/adoption-requests').send({ petId: 1, applicantName: 'Imposter', email: 'imposter@example.com', phone: '555-0000', message: 'Please' }).expect(201);
    expect(created.body.adoptionRequest).toMatchObject({ applicantName: 'Applicant', email: 'applicant@example.com', phone: '555-5555', userId: 1 });
    const list = await agent.get('/api/adoption-requests').expect(200);
    expect(list.body.adoptionRequests).toHaveLength(1);
    await request(app).get('/api/adoption-requests').expect(401);
  });

  it('rejects unavailable pets and applies management approval/rejection state transitions', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Applicant', email: 'applicant@example.com', password: 'password-123', phone: '555-5555' }).expect(201);
    const first = await agent.post('/api/adoption-requests').send({ petId: 1, applicantName: 'Applicant', email: 'applicant@example.com', phone: '555-5555', message: 'Please' }).expect(201);
    const unavailable = await agent.post('/api/adoption-requests').send({ petId: 1, applicantName: 'Applicant', email: 'applicant@example.com', phone: '555-5555', message: 'Again' }).expect(409);
    expect(unavailable.body.error.code).toBe('PET_UNAVAILABLE');
    await request(app).patch(`/api/adoption-requests/${first.body.adoptionRequest.id}`).set('x-api-key', MANAGEMENT_API_KEY).send({ status: 'approved' }).expect(200);
    expect((await request(app).get('/api/pets/1')).body.pet.status).toBe('adopted');
  });

  it('accepts HTTP image references but rejects executable URL schemes', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Owner', email: 'url-owner@example.com', password: 'password-123' }).expect(201);
    const fields = { name: 'Pip', species: 'rabbit', breed: 'Lionhead', age: 1, gender: 'female', size: 'small', description: 'Calm rabbit' };
    const rejected = await agent.post('/api/pets').send({ ...fields, imageUrl: 'javascript:alert(1)' }).expect(400);
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
    const dataUrl = await agent.post('/api/pets').send({ ...fields, imageUrl: 'data:image/png;base64,AA==' }).expect(400);
    expect(dataUrl.body.error.code).toBe('VALIDATION_ERROR');
    const accepted = await agent.post('/api/pets').send({ ...fields, imageUrl: 'https://example.com/pip.png' }).expect(201);
    expect(accepted.body.pet.imageUrl).toBe('https://example.com/pip.png');
  });

  it('preserves generated image references when updating without a replacement upload', async () => {
    const { app } = setup();
    const imageUrl = '/uploads/pets/123e4567-e89b-12d3-a456-426614174000.png';
    const updated = await request(app).patch('/api/pets/1').set('x-api-key', MANAGEMENT_API_KEY).send({ imageUrl }).expect(200);
    expect(updated.body.pet.imageUrl).toBe(imageUrl);
    const renamed = await request(app).patch('/api/pets/1').set('x-api-key', MANAGEMENT_API_KEY).send({ name: 'Nova' }).expect(200);
    expect(renamed.body.pet.imageUrl).toBe(imageUrl);
  });

  it('preserves management authorization and safe validation errors', async () => {
    const { app } = setup();
    const missing = await request(app).get('/api/adoption-requests').expect(401);
    expect(missing.body.error.code).toBe('UNAUTHORIZED');
    const invalid = await request(app).get('/api/pets?species=fish').expect(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    const unknown = await request(app).get('/api/unknown').expect(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
  });
});
