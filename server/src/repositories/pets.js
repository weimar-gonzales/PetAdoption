import { pool } from '../db/pool.js';

const petColumns = 'id, owner_user_id AS ownerUserId, name, species, breed, age, gender, size, description, image_url AS imageUrl, image_mime_type AS imageMimeType, image_size_bytes AS imageSizeBytes, status, created_at AS createdAt, updated_at AS updatedAt';
const updateColumns = {
  name: 'name', species: 'species', breed: 'breed', age: 'age', gender: 'gender', size: 'size',
  description: 'description', imageUrl: 'image_url', imageMimeType: 'image_mime_type', imageSizeBytes: 'image_size_bytes', status: 'status',
};

const mapFilters = (filters) => {
  const clauses = [];
  const values = [];
  if (filters.search) {
    clauses.push('(name LIKE ? OR breed LIKE ? OR description LIKE ?)');
    const search = `%${filters.search}%`;
    values.push(search, search, search);
  }
  for (const key of ['species', 'breed', 'gender', 'size', 'status']) {
    if (filters[key] !== undefined) {
      clauses.push(`${key} = ?`);
      values.push(filters[key]);
    }
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
};

export const createPetRepository = (db = pool) => ({
  async list(filters = {}) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const { where, values } = mapFilters(filters);
    const [rows] = await db.execute(`SELECT ${petColumns} FROM pets ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]);
    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM pets ${where}`, values);
    return { data: rows, total: Number(countRows[0].total), page, pageSize };
  },

  async findById(id) {
    const [rows] = await db.execute(`SELECT ${petColumns} FROM pets WHERE id = ?`, [id]);
    return rows[0] ?? null;
  },

  async create(input) {
    const [result] = await db.execute(
      'INSERT INTO pets (owner_user_id, name, species, breed, age, gender, size, description, image_url, image_mime_type, image_size_bytes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [input.ownerUserId ?? null, input.name, input.species, input.breed, input.age, input.gender, input.size, input.description, input.imageUrl ?? null, input.imageMimeType ?? null, input.imageSizeBytes ?? null, input.status],
    );
    return this.findById(result.insertId);
  },

  async update(id, input) {
    const entries = Object.entries(input);
    const setClause = entries.map(([key]) => `${updateColumns[key]} = ?`).join(', ');
    const [result] = await db.execute(`UPDATE pets SET ${setClause} WHERE id = ?`, [...entries.map(([, value]) => value ?? null), id]);
    return result.affectedRows ? this.findById(id) : null;
  },

  async remove(id) {
    const [result] = await db.execute('DELETE FROM pets WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
});
