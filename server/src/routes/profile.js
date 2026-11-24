import { Router } from 'express';
import { asyncRoute } from './index.js';
import { requireAuth } from '../middleware/auth.js';
import { profileUpdate } from '../validation/schemas.js';

export const createProfileRouter = (users) => {
  const router = Router();
  router.get('/', requireAuth, (req, res) => res.json({ user: req.user }));
  router.patch('/', requireAuth, asyncRoute(async (req, res) => {
    const user = await users.update(req.user.id, profileUpdate.parse(req.body));
    res.json({ user });
  }));
  router.put('/', requireAuth, asyncRoute(async (req, res) => {
    const user = await users.update(req.user.id, profileUpdate.parse(req.body));
    res.json({ user });
  }));
  return router;
};
