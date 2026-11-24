import crypto from 'node:crypto';
import { AppError } from './error-handler.js';

export const isManagementApiKey = (configuredKey, providedKey) => {
  if (!configuredKey || !providedKey) return false;
  const configuredBuffer = Buffer.from(configuredKey);
  const providedBuffer = Buffer.from(providedKey);
  return configuredBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(configuredBuffer, providedBuffer);
};

export const requireManagementApiKey = (configuredKey) => (req, res, next) => {
  if (!isManagementApiKey(configuredKey, req.get('x-api-key'))) {
    return next(new AppError(401, 'UNAUTHORIZED', 'A valid management API key is required'));
  }
  return next();
};
