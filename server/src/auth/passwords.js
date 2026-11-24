import bcrypt from 'bcryptjs';

const COST = 12;

export const hashPassword = (password) => bcrypt.hash(password, COST);
export const verifyPassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);
