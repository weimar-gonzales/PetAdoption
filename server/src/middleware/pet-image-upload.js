import multer from 'multer';
import { config } from '../config.js';
import { imageUploadField } from '../services/pet-images.js';

export const createPetImageUpload = ({ maxBytes = config.petImageMaxBytes } = {}) => {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
  }).single(imageUploadField);

  return (req, res, next) => parser(req, res, next);
};
