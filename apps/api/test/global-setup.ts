import pg from 'pg';

/** Reset the test database once per run, then migrate and seed it. */
export default async function setup() {
  await import('./env.js');
  const url = process.env.DATABASE_URL!;
  if (!/test/.test(url)) throw new Error(`Refusing to reset a non-test database: ${url}`);

  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await admin.end();

  const { seed } = await import('../src/db/seed.js');
  const { pool } = await import('../src/db/pool.js');
  await seed();
  await pool.end();
}
