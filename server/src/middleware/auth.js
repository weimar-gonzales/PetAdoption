import { AppError } from './error-handler.js';
import { parseSessionCookie } from '../auth/sessions.js';

export const createAuthMiddleware = (sessionRepository) => async (req, res, next) => {
  try {
    const token = parseSessionCookie(req.get('cookie'));
    if (token) req.user = await sessionRepository.findUserByToken(token);
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAuth = (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required'));
  return next();
};
