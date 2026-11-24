const databaseNamePattern = /^[A-Za-z0-9_]+$/;

export const configureDatabaseSql = (schema, seed, databaseName) => {
  if (!databaseNamePattern.test(databaseName)) {
    throw new Error('DB_NAME must contain only letters, numbers, and underscores');
  }

  return {
    schema: schema.replaceAll('pet_adoption', databaseName),
    seed: seed.replaceAll('pet_adoption', databaseName),
  };
};
