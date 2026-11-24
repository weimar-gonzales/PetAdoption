import { pool } from '../db/pool.js';
import { AppError } from '../middleware/error-handler.js';

const requestColumns = 'ar.id, ar.pet_id AS petId, ar.user_id AS userId, ar.applicant_name AS applicantName, ar.email, ar.phone, ar.message, ar.status, ar.created_at AS createdAt, ar.updated_at AS updatedAt';
const updateColumns = {
  applicantName: 'applicant_name', email: 'email', phone: 'phone', message: 'message', status: 'status',
};

const mapFilters = (filters) => {
  const clauses = [];
  const values = [];
  if (filters.status !== undefined) { clauses.push('ar.status = ?'); values.push(filters.status); }
  if (filters.petId !== undefined) { clauses.push('ar.pet_id = ?'); values.push(filters.petId); }
  if (filters.userId !== undefined) { clauses.push('ar.user_id = ?'); values.push(filters.userId); }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
};

const insertRequest = async (connection, input) => {
  const [result] = await connection.execute(
    'INSERT INTO adoption_requests (pet_id, user_id, applicant_name, email, phone, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [input.petId, input.userId ?? null, input.applicantName, input.email, input.phone, input.message, 'pending'],
  );
  return result.insertId;
};

export const createAdoptionRequestRepository = (db = pool) => ({
  async list(filters = {}) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const { where, values } = mapFilters(filters);
    const [rows] = await db.execute(`SELECT ${requestColumns} FROM adoption_requests ar ${where} ORDER BY ar.created_at DESC, ar.id DESC LIMIT ? OFFSET ?`, [...values, pageSize, (page - 1) * pageSize]);
    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM adoption_requests ar ${where}`, values);
    return { data: rows, total: Number(countRows[0].total), page, pageSize };
  },

  async findById(id) {
    const [rows] = await db.execute(`SELECT ${requestColumns} FROM adoption_requests ar WHERE ar.id = ?`, [id]);
    return rows[0] ?? null;
  },

  async create(input) {
    if (!db.getConnection) {
      const [result] = await db.execute(
        'INSERT INTO adoption_requests (pet_id, user_id, applicant_name, email, phone, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [input.petId, input.userId ?? null, input.applicantName, input.email, input.phone, input.message, 'pending'],
      );
      return this.findById(result.insertId);
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [pets] = await connection.execute('SELECT id, status FROM pets WHERE id = ? FOR UPDATE', [input.petId]);
      if (!pets[0]) throw new AppError(404, 'PET_NOT_FOUND', 'Pet not found');
      if (pets[0].status !== 'available') throw new AppError(409, 'PET_UNAVAILABLE', 'Pet is not available for adoption');
      const id = await insertRequest(connection, input);
      await connection.execute("UPDATE pets SET status = 'pending' WHERE id = ?", [input.petId]);
      await connection.commit();
      return this.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async update(id, input) {
    if (input.status && db.getConnection) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [requests] = await connection.execute('SELECT id, pet_id AS petId, status FROM adoption_requests WHERE id = ? FOR UPDATE', [id]);
        const current = requests[0];
        if (!current) { await connection.rollback(); return null; }
        const [pets] = await connection.execute('SELECT id, status FROM pets WHERE id = ? FOR UPDATE', [current.petId]);
        if (!pets[0]) throw new AppError(404, 'PET_NOT_FOUND', 'Pet not found');
        if (current.status === 'pending' && input.status === 'approved') {
          await connection.execute("UPDATE pets SET status = 'adopted' WHERE id = ?", [current.petId]);
        } else if (current.status === 'pending' && input.status === 'rejected') {
          await connection.execute("UPDATE pets SET status = 'available' WHERE id = ?", [current.petId]);
        }
        const entries = Object.entries(input);
        const setClause = entries.map(([key]) => `${updateColumns[key]} = ?`).join(', ');
        await connection.execute(`UPDATE adoption_requests SET ${setClause} WHERE id = ?`, [...entries.map(([, value]) => value), id]);
        await connection.commit();
        return this.findById(id);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    const entries = Object.entries(input);
    const setClause = entries.map(([key]) => `${updateColumns[key]} = ?`).join(', ');
    const [result] = await db.execute(`UPDATE adoption_requests SET ${setClause} WHERE id = ?`, [...entries.map(([, value]) => value), id]);
    return result.affectedRows ? this.findById(id) : null;
  },

  async remove(id) {
    const [result] = await db.execute('DELETE FROM adoption_requests WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
});
