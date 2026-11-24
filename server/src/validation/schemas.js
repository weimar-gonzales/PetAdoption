import { z } from 'zod';

const id = z.coerce.number().int().positive();
const page = z.coerce.number().int().min(1).max(1000).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);
const optionalText = (max) => z.string().trim().min(1).max(max).optional();

export const petIdParams = z.object({ id });
export const adoptionRequestIdParams = z.object({ id });

export const petQuery = z.object({
  search: optionalText(100),
  species: z.enum(['dog', 'cat', 'rabbit', 'bird', 'other']).optional(),
  breed: optionalText(100),
  gender: z.enum(['male', 'female', 'unknown']).optional(),
  size: z.enum(['small', 'medium', 'large']).optional(),
  status: z.enum(['available', 'pending', 'adopted']).optional(),
  page,
  pageSize,
}).strict();

const httpImageUrl = z.string().trim().url().max(500).refine((value) => /^https?:\/\//i.test(value), {
  message: 'Image URL must use HTTP or HTTPS',
});
const managedImageUrl = z.string().trim().regex(/^\/uploads\/pets\/[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(?:jpg|png|gif|webp)$/i, {
  message: 'Stored image URL is invalid',
});
const imageUrl = z.union([httpImageUrl, managedImageUrl]).nullable().optional();

const petFields = {
  name: z.string().trim().min(1).max(100),
  species: z.enum(['dog', 'cat', 'rabbit', 'bird', 'other']),
  breed: z.string().trim().min(1).max(100),
  age: z.coerce.number().int().min(0).max(100),
  gender: z.enum(['male', 'female', 'unknown']).default('unknown'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  description: z.string().trim().min(1).max(5000),
  imageUrl,
  status: z.enum(['available', 'pending', 'adopted']).default('available'),
};

export const createPet = z.object(petFields).strict();
export const updatePet = z.object({
  name: petFields.name.optional(),
  species: petFields.species.optional(),
  breed: petFields.breed.optional(),
  age: petFields.age.optional(),
  gender: petFields.gender.optional(),
  size: petFields.size.optional(),
  description: petFields.description.optional(),
  imageUrl: petFields.imageUrl,
  status: petFields.status.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const registerUser = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  phone: z.string().trim().min(7).max(30).optional(),
  address: z.string().trim().min(1).max(500).optional(),
}).strict();

export const loginUser = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

export const profileUpdate = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  phone: z.string().trim().min(7).max(30).nullable().optional(),
  address: z.string().trim().min(1).max(500).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const adoptionRequestQuery = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  petId: id.optional(),
  page,
  pageSize,
}).strict();

export const createAdoptionRequest = z.object({
  petId: id,
  message: z.string().trim().min(1).max(5000),
  applicantName: z.string().trim().min(1).max(150).optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().min(7).max(30).optional(),
}).strict();

export const updateAdoptionRequest = z.object({
  applicantName: z.string().trim().min(1).max(150).optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().min(7).max(30).optional(),
  message: z.string().trim().min(1).max(5000).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
