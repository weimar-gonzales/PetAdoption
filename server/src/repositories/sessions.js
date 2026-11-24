import { pool } from '../db/pool.js';
import { createSessionToken, hashSessionToken } from '../auth/sessions.js';
import { config } from '../config.js';

export const createSessionRepository = (db = pool) => ({
  async create(userId) {
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + config.sessionMaxAge);
    await db.execute('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [userId, tokenHash, expiresAt]);
    return { token, expiresAt };
  },

  async findUserByToken(token) {
    const tokenHash = hashSessionToken(token);
    const [rows] = await db.execute(
      'SELECT u.id, u.email, u.name, u.phone, u.address, u.created_at AS createdAt, u.updated_at AS updatedAt FROM sessions s INNER JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP',
      [tokenHash],
    );
    return rows[0] ?? null;
  },

  async revoke(token) {
    await db.execute('DELETE FROM sessions WHERE token_hash = ?', [hashSessionToken(token)]);
  },

  async cleanupExpired() {
    await db.execute('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP');
  },
});
