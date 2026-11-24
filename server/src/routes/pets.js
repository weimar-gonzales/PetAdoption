import { Router } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { isManagementApiKey } from '../middleware/management-auth.js';
import { createPetImageUpload } from '../middleware/pet-image-upload.js';
import { createPetImageStorage } from '../services/pet-images.js';
import { asyncRoute } from './index.js';
import { createPet, petIdParams, petQuery, updatePet } from '../validation/schemas.js';

const parseId = (req) => petIdParams.parse(req.params).id;

const canManage = (req, managementApiKey) => isManagementApiKey(managementApiKey, req.get('x-api-key'));
const requireUserOrManagement = (managementApiKey) => (req, res, next) => {
  if (isManagementApiKey(managementApiKey, req.get('x-api-key')) || req.user) return next();
  return next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required'));
};

const requireOwnerOrManagement = (req, pet, managementApiKey) => {
  if (canManage(req, managementApiKey)) return;
  if (!req.user || pet.ownerUserId !== req.user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You are not allowed to manage this pet');
  }
};

const removeStoredImage = async (storage, imageUrl) => {
  if (!imageUrl) return true;
  try {
    return await storage.remove(imageUrl);
  } catch (error) {
    console.error('Pet image cleanup failed', { imageUrl, error });
    return false;
  }
};

export const createPetRouter = (repository, { managementApiKey, imageStorage = createPetImageStorage() } = {}) => {
  const router = Router();
  const uploadImage = createPetImageUpload();

  router.get('/', asyncRoute(async (req, res) => {
    const result = await repository.list(petQuery.parse(req.query));
    res.json({ pets: result.data, pagination: { page: result.page, pageSize: result.pageSize, total: result.total } });
  }));

  router.get('/:id', asyncRoute(async (req, res) => {
    const pet = await repository.findById(parseId(req));
    if (!pet) throw new AppError(404, 'PET_NOT_FOUND', 'Pet not found');
    res.json({ pet });
  }));

  router.post('/', requireUserOrManagement(managementApiKey), uploadImage, asyncRoute(async (req, res) => {
    const input = createPet.parse(req.body);
    let storedImage;
    try {
      storedImage = await imageStorage.save(req.file);
      const pet = await repository.create({ ...input, ...storedImage, ownerUserId: req.user?.id ?? null });
      res.status(201).json({ pet });
    } catch (error) {
      await removeStoredImage(imageStorage, storedImage?.imageUrl);
      throw error;
    }
  }));

  const update = asyncRoute(async (req, res) => {
    const id = parseId(req);
    const current = await repository.findById(id);
    if (!current) throw new AppError(404, 'PET_NOT_FOUND', 'Pet not found');
    requireOwnerOrManagement(req, current, managementApiKey);
    const previousImageUrl = current.imageUrl;
    const input = updatePet.parse(req.body);
    let storedImage;
    try {
      storedImage = await imageStorage.save(req.file);
      const values = storedImage
        ? { ...input, ...storedImage }
        : (Object.hasOwn(input, 'imageUrl') ? { ...input, imageMimeType: null, imageSizeBytes: null } : input);
      const pet = await repository.update(id, values);
      if (!pet) {
        await removeStoredImage(imageStorage, storedImage?.imageUrl);
        throw new AppError(404, 'PET_NOT_FOUND', 'Pet not found');
      }
      if (previousImageUrl && previousImageUrl !== pet.imageUrl) await removeStoredImage(imageStorage, previousImageUrl);
      res.json({ pet });
    } catch (error) {
      if (storedImage?.imageUrl) await removeStoredImage(imageStorage, storedImage.imageUrl);
      throw error;
    }
  });

  router.patch('/:id', uploadImage, update);
  router.put('/:id', uploadImage, update);
  router.delete('/:id', asyncRoute(async (req, res) => {
    const id = parseId(req);
    const current = await repository.findById(id);
    if (!current) throw new AppError(404, 'PET_NOT_FOUND', 'Pet not found');
    requireOwnerOrManagement(req, current, managementApiKey);
    if (!await repository.remove(id)) throw new AppError(404, 'PET_NOT_FOUND', 'Pet not found');
    await removeStoredImage(imageStorage, current.imageUrl);
    res.json({ message: 'Pet deleted' });
  }));

  return router;
};
