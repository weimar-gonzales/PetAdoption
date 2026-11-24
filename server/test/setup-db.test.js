import { describe, expect, it } from 'vitest';
import { configureDatabaseSql } from '../src/db/sql.js';
import { upgradeExistingSchema } from '../src/db/upgrade.js';

describe('database setup SQL configuration', () => {
  it('targets the configured database in both schema and seed SQL', () => {
    const result = configureDatabaseSql(
      'CREATE DATABASE IF NOT EXISTS pet_adoption; USE pet_adoption;',
      'USE pet_adoption; INSERT INTO pets VALUES (1);',
      'local_pet_adoption',
    );

    expect(result.schema).toContain('USE local_pet_adoption;');
    expect(result.seed).toContain('USE local_pet_adoption;');
    expect(result.schema).not.toContain('USE pet_adoption;');
    expect(result.seed).not.toContain('USE pet_adoption;');
  });

  it('rejects unsafe database names', () => {
    expect(() => configureDatabaseSql('', '', 'pet-adoption')).toThrow(
      'DB_NAME must contain only letters, numbers, and underscores',
    );
  });

  it('adds legacy ownership and image columns idempotently across repeated runs', async () => {
    const statements = [];
    const columns = new Set();
    const indexes = new Set();
    const foreignKeys = new Set();
    const connection = {
      execute: async (sql, values) => {
        expect(values[0]).toBe('local_pet_adoption');
        if (sql.includes('information_schema.columns')) return [[...columns].filter((value) => value.table === values[1] && value.column === values[2]).map(() => ({ 1: 1 }))];
        if (sql.includes('information_schema.statistics')) return [[...indexes].filter((value) => value.table === values[1] && value.index === values[2]).map(() => ({ 1: 1 }))];
        return [[...foreignKeys].filter((value) => value.table === values[1] && value.column === values[2] && value.referencedTable === values[3]).map(() => ({ 1: 1 }))];
      },
      query: async (sql) => {
        statements.push(sql);
        const column = sql.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/);
        if (column) columns.add({ table: column[1], column: column[2] });
        const index = sql.match(/ALTER TABLE (\w+) ADD INDEX (\w+)/);
        if (index) indexes.add({ table: index[1], index: index[2] });
        const foreignKey = sql.match(/ALTER TABLE (\w+) ADD CONSTRAINT (\w+) FOREIGN KEY \((\w+)\).*REFERENCES (\w+)/);
        if (foreignKey) foreignKeys.add({ table: foreignKey[1], column: foreignKey[3], referencedTable: foreignKey[4] });
      },
    };

    await upgradeExistingSchema(connection, 'local_pet_adoption');
    await upgradeExistingSchema(connection, 'local_pet_adoption');

    expect(statements).toHaveLength(9);
    expect(statements).toEqual(expect.arrayContaining([
      expect.stringContaining('ADD COLUMN owner_user_id'),
      expect.stringContaining('ADD COLUMN image_mime_type'),
      expect.stringContaining('ADD COLUMN image_size_bytes'),
      expect.stringContaining('ADD COLUMN user_id'),
      expect.stringContaining('fk_pets_owner'),
      expect.stringContaining('fk_requests_user'),
    ]));
  });
});
