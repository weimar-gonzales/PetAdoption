import { Router } from 'express';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { clearSessionCookie, parseSessionCookie, sessionCookie } from '../auth/sessions.js';
import { AppError } from '../middleware/error-handler.js';
import { asyncRoute } from './index.js';
import { loginUser, registerUser } from '../validation/schemas.js';

const safeUser = (user) => {
  const { password, passwordHash, ...result } = user;
  void password;
  void passwordHash;
  return result;
};

export const createAuthRouter = ({ users, sessions }) => {
  const router = Router();

  router.post('/register', asyncRoute(async (req, res) => {
    const input = registerUser.parse(req.body);
    const email = input.email.toLowerCase();
    const existing = await users.findByEmail(email);
    if (existing) throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with that email already exists');
    const user = await users.create({ ...input, email, passwordHash: await hashPassword(input.password) });
    const session = await sessions.create(user.id);
    res.setHeader('Set-Cookie', sessionCookie(session.token));
    res.status(201).json({ user: safeUser(user) });
  }));

  router.post('/login', asyncRoute(async (req, res) => {
    const input = loginUser.parse(req.body);
    const account = await users.findByEmail(input.email.toLowerCase());
    if (!account || !(await verifyPassword(input.password, account.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const session = await sessions.create(account.id);
    res.setHeader('Set-Cookie', sessionCookie(session.token));
    res.json({ user: safeUser(account) });
  }));

  router.get('/me', asyncRoute(async (req, res) => {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required');
    res.json({ user: req.user });
  }));

  router.post('/logout', asyncRoute(async (req, res) => {
    const token = parseSessionCookie(req.get('cookie'));
    if (token) await sessions.revoke(token);
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.json({ message: 'Logged out' });
  }));

  return router;
};
