import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPet, updatePet } from './api.js';

afterEach(() => vi.unstubAllGlobals());

const successfulResponse = (body = { pet: { id: 1 } }) => ({
  ok: true,
  json: async () => body,
});

describe('pet API upload requests', () => {
  it('keeps JSON content types for pet requests without an image', async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
    vi.stubGlobal('fetch', fetchMock);

    await createPet({ name: 'Pip', imageUrl: null });

    expect(fetchMock).toHaveBeenCalledWith('/api/pets', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Pip', imageUrl: null }),
    }));
  });

  it('lets FormData provide the multipart boundary for image uploads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
    vi.stubGlobal('fetch', fetchMock);
    const image = new File(['image bytes'], 'pip.webp', { type: 'image/webp' });

    await createPet({ name: 'Pip', imageUrl: null }, image);

    const options = fetchMock.mock.calls[0][1];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).not.toHaveProperty('Content-Type');
    expect(options.body.get('name')).toBe('Pip');
    expect(options.body.get('image')).toBe(image);
  });

  it('uses the multipart boundary for update uploads too', async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
    vi.stubGlobal('fetch', fetchMock);
    const image = new File(['image bytes'], 'pip.gif', { type: 'image/gif' });

    await updatePet(4, { description: 'Updated' }, image);

    expect(fetchMock).toHaveBeenCalledWith('/api/pets/4', expect.objectContaining({ body: expect.any(FormData) }));
  });
});
