import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { registry, json } from '../../docs/openapi.js';

export const Category = z
  .object({
    id: z.number(),
    slug: z.string(),
    name: z.string(),
    nameBn: z.string().nullable(),
    description: z.string().nullable(),
    basePriceBdt: z.number(),
  })
  .meta({ id: 'Category' });

export function catalogRouter() {
  const r = Router();
  r.get('/', async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT id, slug, name, name_bn AS "nameBn", description, base_price_bdt AS "basePriceBdt"
         FROM service_categories ORDER BY name`,
    );
    res.set('Cache-Control', 'public, max-age=300').json({ items: rows });
  });
  return r;
}

registry.registerPath({
  method: 'get',
  path: '/categories',
  tags: ['Catalog'],
  summary: 'List service categories',
  responses: { 200: json(z.object({ items: z.array(Category) })) },
});

const PublicStats = z
  .object({
    verifiedTechnicians: z.number(),
    jobsCompleted: z.number(),
    averageRating: z.number().nullable(),
    reviews: z.number(),
  })
  .meta({ id: 'PublicStats' });

/** Headline numbers for the landing page. Aggregates only, no personal data. */
export function publicStatsRouter() {
  const r = Router();
  r.get('/', async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT (SELECT count(*) FROM technician_profiles t JOIN users u ON u.id = t.user_id
                WHERE t.is_verified AND u.is_active)::int AS "verifiedTechnicians",
              (SELECT count(*) FROM bookings WHERE status = 'completed')::int AS "jobsCompleted",
              (SELECT round(avg(rating)::numeric, 2)::float FROM reviews) AS "averageRating",
              (SELECT count(*) FROM reviews)::int AS reviews`,
    );
    res.set('Cache-Control', 'public, max-age=60').json(rows[0]);
  });
  return r;
}

registry.registerPath({
  method: 'get',
  path: '/stats',
  tags: ['Catalog'],
  summary: 'Public platform numbers for the landing page',
  responses: { 200: json(PublicStats) },
});

const RecentReview = z
  .object({
    rating: z.number(),
    comment: z.string(),
    customerName: z.string(),
    technicianName: z.string(),
    category: z.string(),
    createdAt: z.string(),
  })
  .meta({ id: 'RecentReview' });

/** Recent positive written reviews for the landing page. Names are shortened ("Rahim U."). */
export function recentReviewsRouter() {
  const r = Router();
  r.get('/', async (_req, res) => {
    const short = (col: string) =>
      `trim(split_part(${col}, ' ', 1) || ' ' || COALESCE(NULLIF(left(split_part(${col}, ' ', 2), 1), '') || '.', ''))`;
    const { rows } = await pool.query(
      `SELECT r.rating, r.comment, ${short('cu.full_name')} AS "customerName",
              ${short('tu.full_name')} AS "technicianName", c.name AS category, r.created_at AS "createdAt"
         FROM reviews r
         JOIN bookings b ON b.id = r.booking_id
         JOIN service_categories c ON c.id = b.category_id
         JOIN users cu ON cu.id = r.customer_id AND cu.is_active
         JOIN users tu ON tu.id = r.technician_id AND tu.is_active
        WHERE r.rating >= 4 AND r.comment IS NOT NULL AND length(r.comment) >= 10
        ORDER BY r.created_at DESC
        LIMIT 12`,
    );
    res.set('Cache-Control', 'public, max-age=120').json({ items: rows });
  });
  return r;
}

registry.registerPath({
  method: 'get',
  path: '/reviews/recent',
  tags: ['Catalog'],
  summary: 'Recent positive reviews for the landing page (names shortened)',
  responses: { 200: json(z.object({ items: z.array(RecentReview) })) },
});
