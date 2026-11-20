/**
 * Create the first administrator in a real (non-demo) deployment.
 * Admins can never be created through public sign-up.
 *
 *   docker compose -f docker-compose.prod.yml exec \
 *     -e ADMIN_EMAIL=you@example.com -e ADMIN_NAME="Your Name" -e ADMIN_PASSWORD='…' \
 *     api node dist/scripts/create-admin.js
 *
 * The password is read from the environment (not argv) so it doesn't end up in
 * shell history or `ps` output. Prefer `read -s ADMIN_PASSWORD` before running.
 */
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { migrate } from '../db/migrator.js';
import { logger } from '../lib/logger.js';
import { password } from '../modules/auth/auth.schemas.js';

const Input = z.object({
  ADMIN_EMAIL: z.email(),
  ADMIN_NAME: z.string().trim().min(2).max(100),
  ADMIN_PASSWORD: password.refine(
    (p) => p.length >= 12,
    'Admin passwords need at least 12 characters',
  ),
});

try {
  const input = Input.parse(process.env);
  await migrate(pool);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [input.ADMIN_EMAIL, await bcrypt.hash(input.ADMIN_PASSWORD, 12), input.ADMIN_NAME],
  );
  if (!rows[0]) throw new Error(`A user with email ${input.ADMIN_EMAIL} already exists`);
  logger.info({ id: rows[0].id, email: input.ADMIN_EMAIL }, 'Admin created');
} catch (err) {
  const message =
    err instanceof z.ZodError
      ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      : (err as Error).message;
  logger.fatal(message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
