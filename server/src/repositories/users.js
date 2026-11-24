import { pool } from '../db/pool.js';

const userColumns = 'id, email, name, phone, address, created_at AS createdAt, updated_at AS updatedAt';
const updateColumns = { name: 'name', phone: 'phone', address: 'address' };

export const createUserRepository = (db = pool) => ({
  async findByEmail(email) {
    const [rows] = await db.execute(`SELECT ${userColumns}, password_hash AS passwordHash FROM users WHERE email = ?`, [email]);
    return rows[0] ?? null;
  },

  async findById(id) {
    const [rows] = await db.execute(`SELECT ${userColumns} FROM users WHERE id = ?`, [id]);
    return rows[0] ?? null;
  },

  async create(input) {
    const [result] = await db.execute(
      'INSERT INTO users (email, password_hash, name, phone, address) VALUES (?, ?, ?, ?, ?)',
      [input.email, input.passwordHash, input.name, input.phone ?? null, input.address ?? null],
    );
    return this.findById(result.insertId);
  },

  async update(id, input) {
    const entries = Object.entries(input);
    const setClause = entries.map(([key]) => `${updateColumns[key]} = ?`).join(', ');
    const [result] = await db.execute(`UPDATE users SET ${setClause} WHERE id = ?`, [...entries.map(([, value]) => value ?? null), id]);
    return result.affectedRows ? this.findById(id) : null;
  },
});
