import type { Queryable } from '../../db/pool.js';
import type { Role } from '../../lib/tokens.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  role: Role;
  avatar_url: string | null;
  is_active: boolean;
  created_at: Date;
}

export const toPublicUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  fullName: u.full_name,
  phone: u.phone,
  role: u.role,
  avatarUrl: u.avatar_url,
  createdAt: u.created_at.toISOString(),
});
export type PublicUser = ReturnType<typeof toPublicUser>;

export async function findUserById(db: Queryable, id: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

export async function findUserByEmail(db: Queryable, email: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}
