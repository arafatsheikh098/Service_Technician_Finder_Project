import { pool } from './pool.js';
import { migrate } from './migrator.js';
import { logger } from '../lib/logger.js';

try {
  await migrate(pool, (m) => logger.info(m));
  logger.info('Database is up to date');
} catch (err) {
  logger.fatal({ err }, 'Migration failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
