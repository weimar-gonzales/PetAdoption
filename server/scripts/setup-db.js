import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config.js';
import { configureDatabaseSql } from '../src/db/sql.js';
import { upgradeExistingSchema } from '../src/db/upgrade.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const schema = await fs.readFile(path.join(directory, '../db/schema.sql'), 'utf8');
const seed = await fs.readFile(path.join(directory, '../db/seed.sql'), 'utf8');
const { schema: configuredSchema, seed: configuredSeed } = configureDatabaseSql(schema, seed, config.database.name);

const connection = await mysql.createConnection({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  multipleStatements: true,
});

try {
  await connection.query(configuredSchema);
  await upgradeExistingSchema(connection, config.database.name);
  await connection.query(configuredSeed);
  console.log('Database schema and seed completed.');
} finally {
  await connection.end();
}
