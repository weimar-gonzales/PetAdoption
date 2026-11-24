const request = async (path, options = {}) => {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = isFormData ? { ...options.headers } : { 'Content-Type': 'application/json', ...options.headers };
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message || 'Something went wrong. Please try again.');
    error.code = body.error?.code;
    error.details = body.error?.details;
    throw error;
  }
  return body;
};

const petBody = (data, imageFile) => {
  if (!imageFile) return JSON.stringify(data);
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== '') formData.append(key, String(value));
  }
  formData.append('image', imageFile);
  return formData;
};

export const getPets = async (filters = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return request(`/api/pets${query ? `?${query}` : ''}`);
};

export const getPet = (id) => request(`/api/pets/${id}`);

export const getCurrentUser = () => request('/api/auth/me');
export const registerUser = (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const loginUser = (data) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const logoutUser = () => request('/api/auth/logout', { method: 'POST' });
export const getProfile = () => request('/api/profile');
export const updateProfile = (data) => request('/api/profile', { method: 'PATCH', body: JSON.stringify(data) });

export const createPet = (data, imageFile) => request('/api/pets', { method: 'POST', body: petBody(data, imageFile) });
export const updatePet = (id, data, imageFile) => request(`/api/pets/${id}`, { method: 'PATCH', body: petBody(data, imageFile) });
export const deletePet = (id) => request(`/api/pets/${id}`, { method: 'DELETE' });

export const submitAdoption = (data) => request('/api/adoption-requests', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const getAdoptionRequests = () => request('/api/adoption-requests');
