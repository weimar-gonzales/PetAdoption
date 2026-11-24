import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const numberFromEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: numberFromEnv('PORT', 3001),
  database: Object.freeze({
    host: process.env.DB_HOST ?? 'localhost',
    port: numberFromEnv('DB_PORT', 3306),
    name: process.env.DB_NAME ?? 'pet_adoption',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    connectionLimit: numberFromEnv('DB_CONNECTION_LIMIT', 10),
  }),
  managementApiKey: process.env.MANAGEMENT_API_KEY ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? '',
  sessionMaxAge: numberFromEnv('SESSION_MAX_AGE_MS', 1000 * 60 * 60 * 24 * 7),
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? 'pet_adoption_session',
  secureCookies: process.env.SECURE_COOKIES === 'true' || (process.env.NODE_ENV ?? 'development') === 'production',
  petImageMaxBytes: numberFromEnv('PET_IMAGE_MAX_BYTES', 5 * 1024 * 1024),
  petImageDirectory: process.env.PET_IMAGE_DIRECTORY ? path.resolve(serverDirectory, process.env.PET_IMAGE_DIRECTORY) : path.join(serverDirectory, 'uploads', 'pets'),
});
