import express from 'express';
import { createAdoptionRequestRepository } from './repositories/adoption-requests.js';
import { createPetImageStorage } from './services/pet-images.js';
import { createPetRepository } from './repositories/pets.js';
import { createSessionRepository } from './repositories/sessions.js';
import { createUserRepository } from './repositories/users.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createAdoptionRequestRouter } from './routes/adoption-requests.js';
import { createAuthRouter } from './routes/auth.js';
import { createPetRouter } from './routes/pets.js';
import { createProfileRouter } from './routes/profile.js';
import { config } from './config.js';

export const createApp = ({ petRepository, adoptionRequestRepository, userRepository, sessionRepository, managementApiKey = config.managementApiKey, imageStorage } = {}) => {
  const app = express();
  const pets = petRepository ?? createPetRepository();
  const adoptionRequests = adoptionRequestRepository ?? createAdoptionRequestRepository();
  const users = userRepository ?? createUserRepository();
  const sessions = sessionRepository ?? createSessionRepository();
  const petImages = imageStorage ?? createPetImageStorage();

  app.use(express.json({ limit: '100kb' }));
  app.use('/uploads/pets', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    if (!/^\/[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(?:jpg|png|gif|webp)$/i.test(req.path)) return res.status(404).end();
    return next();
  }, express.static(petImages.directory, { dotfiles: 'deny', index: false }));
  app.use(createAuthMiddleware(sessions));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', createAuthRouter({ users, sessions }));
  app.use('/api/profile', createProfileRouter(users));
  app.use('/api/pets', createPetRouter(pets, { managementApiKey, imageStorage: petImages }));
  app.use('/api/adoption-requests', createAdoptionRequestRouter(adoptionRequests, { managementApiKey }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
};
