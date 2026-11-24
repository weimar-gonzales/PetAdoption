const hasColumn = async (connection, databaseName, table, column) => {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ? LIMIT 1',
    [databaseName, table, column],
  );
  return rows.length > 0;
};

const hasIndex = async (connection, databaseName, table, index) => {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
    [databaseName, table, index],
  );
  return rows.length > 0;
};

const hasForeignKey = async (connection, databaseName, table, column, referencedTable) => {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.key_column_usage WHERE table_schema = ? AND table_name = ? AND column_name = ? AND referenced_table_name = ? LIMIT 1',
    [databaseName, table, column, referencedTable],
  );
  return rows.length > 0;
};

export const upgradeExistingSchema = async (connection, databaseName) => {
  if (!await hasColumn(connection, databaseName, 'pets', 'owner_user_id')) {
    await connection.query('ALTER TABLE pets ADD COLUMN owner_user_id INT UNSIGNED NULL AFTER id');
  }
  if (!await hasColumn(connection, databaseName, 'pets', 'image_mime_type')) {
    await connection.query('ALTER TABLE pets ADD COLUMN image_mime_type VARCHAR(50) NULL AFTER image_url');
  }
  if (!await hasColumn(connection, databaseName, 'pets', 'image_size_bytes')) {
    await connection.query('ALTER TABLE pets ADD COLUMN image_size_bytes INT UNSIGNED NULL AFTER image_mime_type');
  }

  if (!await hasIndex(connection, databaseName, 'pets', 'idx_pets_owner_user_id')) {
    await connection.query('ALTER TABLE pets ADD INDEX idx_pets_owner_user_id (owner_user_id)');
  }
  if (!await hasForeignKey(connection, databaseName, 'pets', 'owner_user_id', 'users')) {
    await connection.query('ALTER TABLE pets ADD CONSTRAINT fk_pets_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE');
  }

  if (!await hasColumn(connection, databaseName, 'adoption_requests', 'user_id')) {
    await connection.query('ALTER TABLE adoption_requests ADD COLUMN user_id INT UNSIGNED NULL AFTER pet_id');
  }
  if (!await hasIndex(connection, databaseName, 'adoption_requests', 'idx_requests_user_id')) {
    await connection.query('ALTER TABLE adoption_requests ADD INDEX idx_requests_user_id (user_id)');
  }
  if (!await hasIndex(connection, databaseName, 'adoption_requests', 'idx_requests_user_status')) {
    await connection.query('ALTER TABLE adoption_requests ADD INDEX idx_requests_user_status (user_id, status)');
  }
  if (!await hasForeignKey(connection, databaseName, 'adoption_requests', 'user_id', 'users')) {
    await connection.query('ALTER TABLE adoption_requests ADD CONSTRAINT fk_requests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE');
  }
};
