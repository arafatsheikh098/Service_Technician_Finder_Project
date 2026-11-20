import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { env } from '../../config/env.js';
import { pool, withTransaction, pgCode, PgError, type Queryable } from '../../db/pool.js';
import { AppError, badRequest, conflict, unauthorized } from '../../lib/errors.js';
import { randomToken, sha256 } from '../../lib/crypto.js';
import { signAccessToken } from '../../lib/tokens.js';
import { revokeAccessTokens } from '../../lib/revocation.js';
import type { Notifier } from '../../jobs/notifications.js';
import { findUserByEmail, findUserById, toPublicUser, type UserRow } from '../users/users.repo.js';
import type { RegisterBody } from './auth.schemas.js';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MIN = 30;
// A real bcrypt hash of a random string. Comparing against it when the email does
// not exist keeps login timing the same, so attackers can't probe for accounts.
const DUMMY_HASH = bcrypt.hashSync(randomToken(), BCRYPT_ROUNDS);

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

async function issueTokens(
  db: Queryable,
  user: UserRow,
  familyId: string = randomUUID(),
): Promise<IssuedTokens> {
  const refreshToken = randomToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await db.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [user.id, familyId, sha256(refreshToken), refreshExpiresAt],
  );
  return {
    accessToken: signAccessToken({ id: user.id, role: user.role }),
    refreshToken,
    refreshExpiresAt,
  };
}

export function createAuthService(notifier: Notifier) {
  return {
    async register(input: z.infer<typeof RegisterBody>) {
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      const result = await withTransaction(async (tx) => {
        let user: UserRow;
        try {
          const { rows } = await tx.query<UserRow>(
            `INSERT INTO users (email, password_hash, full_name, phone, role)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [input.email, passwordHash, input.fullName, input.phone ?? null, input.role],
          );
          user = rows[0]!;
        } catch (err) {
          if (pgCode(err) === PgError.UNIQUE_VIOLATION) {
            throw conflict('An account with this email already exists', 'EMAIL_TAKEN');
          }
          throw err;
        }

        if (input.role === 'technician') {
          const p = input.profile;
          await tx.query(
            `INSERT INTO technician_profiles
               (user_id, bio, experience_years, hourly_rate_bdt, location, area_label, service_radius_km)
             VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8)`,
            [
              user.id,
              p.bio ?? null,
              p.experienceYears,
              p.hourlyRateBdt,
              p.lng,
              p.lat,
              p.areaLabel ?? null,
              p.serviceRadiusKm,
            ],
          );
          try {
            await tx.query(
              `INSERT INTO technician_services (technician_id, category_id)
               SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
              [user.id, p.categoryIds],
            );
          } catch (err) {
            if (pgCode(err) === PgError.FOREIGN_KEY_VIOLATION)
              throw badRequest('Unknown service category');
            throw err;
          }
        }
        const tokens = await issueTokens(tx, user);
        return { user, tokens };
      });

      await notifier.send({ type: 'welcome', to: result.user.email, name: result.user.full_name });
      return { user: toPublicUser(result.user), tokens: result.tokens };
    },

    async login(email: string, password: string) {
      const user = await findUserByEmail(pool, email);
      const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
      if (!user || !ok) throw unauthorized('Incorrect email or password');
      if (!user.is_active)
        throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
      const tokens = await issueTokens(pool, user);
      return { user: toPublicUser(user), tokens };
    },

    /**
     * Rotate a refresh token. Presenting a token that was already rotated means it
     * leaked (the legitimate client would hold the newer one), so the whole token
     * family is revoked and everyone holding it is logged out.
     */
    async refresh(refreshToken: string) {
      const result = await withTransaction(async (tx) => {
        const { rows } = await tx.query<{
          id: string;
          user_id: string;
          family_id: string;
          expires_at: Date;
          rotated_at: Date | null;
          revoked_at: Date | null;
        }>('SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE', [sha256(refreshToken)]);
        const row = rows[0];
        if (!row) throw unauthorized('Session expired. Please log in again.');

        if (row.rotated_at || row.revoked_at) {
          await tx.query(
            'UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL',
            [row.family_id],
          );
          // Return instead of throwing: a throw here would roll back the revocation.
          return { replayed: true as const, userId: row.user_id };
        }
        if (row.expires_at.getTime() < Date.now())
          throw unauthorized('Session expired. Please log in again.');

        const user = await findUserById(tx, row.user_id);
        if (!user || !user.is_active) throw unauthorized();

        await tx.query('UPDATE refresh_tokens SET rotated_at = now() WHERE id = $1', [row.id]);
        const tokens = await issueTokens(tx, user, row.family_id);
        return { replayed: false as const, user: toPublicUser(user), tokens };
      });
      if (result.replayed) {
        // Whoever holds the stolen token may also hold a live access token.
        await revokeAccessTokens(result.userId);
        throw unauthorized('Session expired. Please log in again.');
      }
      return { user: result.user, tokens: result.tokens };
    },

    async logout(refreshToken: string | undefined) {
      if (!refreshToken) return;
      await pool.query(
        `UPDATE refresh_tokens SET revoked_at = now()
          WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)
            AND revoked_at IS NULL`,
        [sha256(refreshToken)],
      );
    },

    /** Always succeeds from the caller's point of view, so it can't be used to discover accounts. */
    async forgotPassword(email: string) {
      const user = await findUserByEmail(pool, email);
      if (!user || !user.is_active) return;
      const token = randomToken();
      await pool.query(
        `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
         VALUES ($1, $2, now() + make_interval(mins => $3))`,
        [sha256(token), user.id, RESET_TOKEN_TTL_MIN],
      );
      await notifier.send({
        type: 'password_reset',
        to: user.email,
        name: user.full_name,
        resetUrl: `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`,
      });
    },

    async resetPassword(token: string, newPassword: string) {
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      const userId = await withTransaction(async (tx) => {
        const { rows } = await tx.query<{ user_id: string }>(
          `UPDATE password_reset_tokens SET used_at = now()
            WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
            RETURNING user_id`,
          [sha256(token)],
        );
        const found = rows[0]?.user_id;
        if (!found) throw badRequest('This reset link is invalid or has expired');
        await tx.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, found]);
        // Changing the password signs out every existing session.
        await tx.query(
          'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
          [found],
        );
        return found;
      });
      await revokeAccessTokens(userId);
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
