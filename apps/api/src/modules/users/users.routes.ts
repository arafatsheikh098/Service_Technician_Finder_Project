import { Router } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { env, isProd } from '../../config/env.js';
import { pool, withTransaction } from '../../db/pool.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { randomToken, sha256 } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import { revokeAccessTokens } from '../../lib/revocation.js';
import { signAccessToken } from '../../lib/tokens.js';
import { parse } from '../../lib/validate.js';
import type { Deps } from '../../lib/deps.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { registry, errors, json, secured } from '../../docs/openapi.js';
import { PublicUser, password } from '../auth/auth.schemas.js';
import { findUserById, toPublicUser, type UserRow } from './users.repo.js';

const REFRESH_COOKIE = 'tf_rt';

const UpdateMeBody = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .regex(/^(?:\+?88)?01[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number')
      .nullable(),
  })
  .partial()
  .meta({ id: 'UpdateMe' });

const ChangePasswordBody = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: password })
  .meta({ id: 'ChangePassword' });

const DeleteAccountBody = z
  .object({ password: z.string().min(1).max(200), confirm: z.literal('DELETE') })
  .meta({ id: 'DeleteAccount' });

// Detect the real file type from its first bytes; never trust the client's mimetype.
function sniffImage(buf: Buffer): boolean {
  const jpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png =
    buf.length > 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp =
    buf.length > 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP';
  return jpg || png || webp;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const AVATAR_DIR = () => path.resolve(env.UPLOAD_DIR, 'avatars');

async function removeOldAvatar(url: string | null) {
  if (!url?.startsWith('/uploads/avatars/')) return;
  const file = path.join(AVATAR_DIR(), path.basename(url));
  await unlink(file).catch(() => {});
}

async function verifyPassword(userId: string, plain: string) {
  const user = await findUserById(pool, userId);
  if (!user) throw notFound('User');
  // 400, not 401: the session is valid, only the typed password is wrong.
  if (!(await bcrypt.compare(plain, user.password_hash))) throw badRequest('Password is incorrect');
  return user;
}

export function usersRouter(deps: Deps) {
  const r = Router();
  r.use(requireAuth);

  r.get('/me', async (req, res) => {
    const user = await findUserById(pool, currentUser(req).id);
    if (!user) throw notFound('User');
    res.json(toPublicUser(user));
  });

  r.patch('/me', async (req, res) => {
    const body = parse(UpdateMeBody, req.body);
    const { rows } = await pool.query<UserRow>(
      `UPDATE users SET full_name = COALESCE($2, full_name),
                        phone = CASE WHEN $3::boolean THEN $4 ELSE phone END
        WHERE id = $1 RETURNING *`,
      [currentUser(req).id, body.fullName ?? null, body.phone !== undefined, body.phone ?? null],
    );
    if (!rows[0]) throw notFound('User');
    res.json(toPublicUser(rows[0]));
  });

  /**
   * Change password. Every *other* session is signed out (their refresh tokens are
   * revoked and their access tokens rejected); this session gets a fresh access token.
   */
  r.post('/me/password', async (req, res) => {
    const body = parse(ChangePasswordBody, req.body);
    const user = await verifyPassword(currentUser(req).id, body.currentPassword);
    const currentRefresh = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await withTransaction(async (tx) => {
      await tx.query('UPDATE users SET password_hash = $2 WHERE id = $1', [
        user.id,
        await bcrypt.hash(body.newPassword, 12),
      ]);
      await tx.query(
        `UPDATE refresh_tokens SET revoked_at = now()
          WHERE user_id = $1 AND revoked_at IS NULL
            AND family_id IS DISTINCT FROM (SELECT family_id FROM refresh_tokens WHERE token_hash = $2)`,
        [user.id, currentRefresh ? sha256(currentRefresh) : null],
      );
    });
    const revokedAt = await revokeAccessTokens(user.id);
    res.json({
      accessToken: signAccessToken({ id: user.id, role: user.role }, { issuedAt: revokedAt + 1 }),
    });
  });

  r.post('/me/avatar', upload.single('avatar'), async (req, res) => {
    if (!req.file) throw badRequest('Attach an image in the "avatar" field');
    if (!sniffImage(req.file.buffer)) throw badRequest('Avatar must be a JPEG, PNG or WebP image');
    let processed: Buffer;
    try {
      // Re-encode: strips EXIF/GPS metadata (privacy), applies orientation, caps the
      // size, and refuses decompression bombs. Anything that isn't a real image fails here.
      processed = await sharp(req.file.buffer, { limitInputPixels: 40_000_000, failOn: 'error' })
        .rotate()
        .resize(512, 512, { fit: 'cover' })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw badRequest('That image could not be read');
    }
    // Random server-chosen filename: no path traversal, no overwriting other users' files.
    const name = `${randomUUID()}.webp`;
    await mkdir(AVATAR_DIR(), { recursive: true });
    await writeFile(path.join(AVATAR_DIR(), name), processed);
    const previous = await findUserById(pool, currentUser(req).id);
    const { rows } = await pool.query<UserRow>(
      'UPDATE users SET avatar_url = $2 WHERE id = $1 RETURNING *',
      [currentUser(req).id, `/uploads/avatars/${name}`],
    );
    await removeOldAvatar(previous?.avatar_url ?? null);
    res.json(toPublicUser(rows[0]!));
  });

  /**
   * Delete my account. Bookings, reviews and payments must stay intact for the other
   * party and for accounting, so personal data is erased (anonymised) instead of the
   * rows being deleted. Active bookings are cancelled and every session is ended.
   */
  r.delete('/me', async (req, res) => {
    const me = currentUser(req);
    if (me.role === 'admin') throw forbidden('Admin accounts cannot be deleted from the app');
    const body = parse(DeleteAccountBody, req.body);
    const user = await verifyPassword(me.id, body.password);

    const cancelled = await withTransaction(async (tx) => {
      const { rows: active } = await tx.query<{
        id: string;
        status: string;
        customer_id: string;
        technician_id: string;
      }>(
        `UPDATE bookings SET status = 'cancelled', cancel_reason = 'Account deleted'
          WHERE (customer_id = $1 OR technician_id = $1)
            AND status IN ('pending', 'accepted', 'en_route', 'in_progress')
          RETURNING id, status, customer_id, technician_id`,
        [me.id],
      );
      for (const b of active) {
        await tx.query(
          `INSERT INTO booking_events (booking_id, from_status, to_status, actor_id, note)
           VALUES ($1, NULL, 'cancelled', $2, 'Account deleted')`,
          [b.id, me.id],
        );
      }
      await tx.query(
        `UPDATE users SET email = $2, full_name = 'Deleted user', phone = NULL, avatar_url = NULL,
                          password_hash = $3, is_active = false
          WHERE id = $1`,
        [me.id, `deleted+${me.id}@deleted.invalid`, sha256(randomToken())],
      );
      await tx.query(
        `UPDATE technician_profiles SET bio = NULL, area_label = NULL, is_available = false, is_verified = false
          WHERE user_id = $1`,
        [me.id],
      );
      await tx.query('DELETE FROM messages WHERE sender_id = $1', [me.id]);
      await tx.query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [me.id],
      );
      await tx.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [me.id]);
      await tx.query('DELETE FROM idempotency_keys WHERE user_id = $1', [me.id]);
      return active;
    });

    await revokeAccessTokens(me.id);
    await removeOldAvatar(user.avatar_url);
    for (const b of cancelled) {
      const other = b.customer_id === me.id ? b.technician_id : b.customer_id;
      deps.realtime.toUser(other, 'booking.updated', { bookingId: b.id, status: 'cancelled' });
    }
    deps.realtime.disconnectUser(me.id);
    logger.info({ userId: me.id, cancelledBookings: cancelled.length }, 'Account deleted');
    res.clearCookie(REFRESH_COOKIE, {
      path: '/api/v1/auth',
      secure: isProd,
      sameSite: 'strict',
      httpOnly: true,
    });
    res.status(204).end();
  });

  return r;
}

const tag = ['Users'];
registry.registerPath({
  method: 'get',
  path: '/users/me',
  tags: tag,
  security: secured,
  summary: 'Current user',
  responses: { 200: json(PublicUser), 401: errors[401] },
});
registry.registerPath({
  method: 'patch',
  path: '/users/me',
  tags: tag,
  security: secured,
  summary: 'Update name or phone',
  request: { body: { content: { 'application/json': { schema: UpdateMeBody } } } },
  responses: { 200: json(PublicUser), 400: errors[400] },
});
registry.registerPath({
  method: 'post',
  path: '/users/me/password',
  tags: tag,
  security: secured,
  summary: 'Change password; signs out all other sessions and returns a fresh access token',
  request: { body: { content: { 'application/json': { schema: ChangePasswordBody } } } },
  responses: { 200: json(z.object({ accessToken: z.string() })), 400: errors[400] },
});
registry.registerPath({
  method: 'post',
  path: '/users/me/avatar',
  tags: tag,
  security: secured,
  summary:
    'Upload a profile photo (JPEG/PNG/WebP, max 2 MB). Re-encoded to 512px WebP with metadata stripped',
  responses: { 200: json(PublicUser), 400: errors[400] },
});
registry.registerPath({
  method: 'delete',
  path: '/users/me',
  tags: tag,
  security: secured,
  summary: 'Delete (anonymise) my account; requires password and confirm: "DELETE"',
  request: { body: { content: { 'application/json': { schema: DeleteAccountBody } } } },
  responses: { 204: { description: 'Deleted' }, 400: errors[400], 403: errors[403] },
});
