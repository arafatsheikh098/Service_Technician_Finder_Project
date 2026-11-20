import { z } from 'zod';
import { pool, withTransaction, pgCode, PgError } from '../../db/pool.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { rank, type RankBreakdown } from './ranking.js';

/** How many nearest candidates we pull before ranking in application code. */
const CANDIDATE_LIMIT = 300;

export const SearchQuery = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    category: z.string().max(50).optional().describe('Category slug, e.g. "plumber"'),
    radiusKm: z.coerce.number().min(1).max(50).default(10),
    from: z.iso
      .datetime({ offset: true })
      .optional()
      .describe('Only technicians free from this time'),
    to: z.iso.datetime({ offset: true }).optional(),
    sort: z.enum(['best', 'distance', 'rating', 'price']).default('best'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((q) => (q.from === undefined) === (q.to === undefined), {
    message: 'from and to must be given together',
    path: ['to'],
  })
  .refine((q) => !q.from || !q.to || new Date(q.from) < new Date(q.to), {
    message: 'to must be after from',
    path: ['to'],
  });
export type SearchQuery = z.infer<typeof SearchQuery>;

export const TechnicianSummary = z
  .object({
    id: z.uuid(),
    fullName: z.string(),
    avatarUrl: z.string().nullable(),
    areaLabel: z.string().nullable(),
    experienceYears: z.number(),
    hourlyRateBdt: z.number(),
    distanceKm: z.number(),
    lat: z.number(),
    lng: z.number(),
    ratingAvg: z.number().nullable(),
    ratingCount: z.number(),
    jobsCompleted: z.number(),
    categories: z.array(z.string()),
    rank: z.object({
      score: z.number(),
      bayesianRating: z.number(),
      components: z.object({
        rating: z.number(),
        proximity: z.number(),
        reliability: z.number(),
        experience: z.number(),
      }),
    }),
  })
  .meta({ id: 'TechnicianSummary' });
export type TechnicianSummary = z.infer<typeof TechnicianSummary>;

interface CandidateRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
  area_label: string | null;
  experience_years: number;
  hourly_rate_bdt: number;
  distance_m: number;
  lat: number;
  lng: number;
  rating_sum: number;
  rating_count: number;
  jobs_offered: number;
  jobs_accepted: number;
  jobs_completed: number;
  categories: string[];
}

export async function searchTechnicians(q: SearchQuery) {
  const params: unknown[] = [q.lng, q.lat, q.radiusKm * 1000];
  let categoryFilter = '';
  if (q.category) {
    params.push(q.category);
    categoryFilter = `AND EXISTS (
      SELECT 1 FROM technician_services ts JOIN service_categories c ON c.id = ts.category_id
       WHERE ts.technician_id = t.user_id AND c.slug = $${params.length})`;
  }
  let availabilityFilter = '';
  if (q.from && q.to) {
    params.push(q.from, q.to);
    availabilityFilter = `AND NOT EXISTS (
      SELECT 1 FROM bookings b
       WHERE b.technician_id = t.user_id
         AND b.status IN ('pending', 'accepted', 'en_route', 'in_progress')
         AND b.slot && tstzrange($${params.length - 1}::timestamptz, $${params.length}::timestamptz, '[)'))`;
  }
  params.push(CANDIDATE_LIMIT);

  // ST_DWithin on a geography column uses the GiST index; the distance is in metres.
  // A technician is only shown if the customer is also inside *their* service radius.
  const sql = `
    WITH origin AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
    SELECT u.id, u.full_name, u.avatar_url, t.area_label, t.experience_years, t.hourly_rate_bdt,
           ST_Distance(t.location, origin.g) AS distance_m,
           ST_Y(t.location::geometry) AS lat, ST_X(t.location::geometry) AS lng,
           t.rating_sum, t.rating_count, t.jobs_offered, t.jobs_accepted, t.jobs_completed,
           ARRAY(SELECT c.slug FROM technician_services ts
                   JOIN service_categories c ON c.id = ts.category_id
                  WHERE ts.technician_id = t.user_id ORDER BY c.slug) AS categories
      FROM technician_profiles t
      JOIN users u ON u.id = t.user_id
      CROSS JOIN origin
     WHERE t.is_verified AND t.is_available AND u.is_active
       AND ST_DWithin(t.location, origin.g, $3)
       AND ST_DWithin(t.location, origin.g, t.service_radius_km * 1000)
       ${categoryFilter}
       ${availabilityFilter}
     ORDER BY t.location <-> origin.g
     LIMIT $${params.length}`;

  const { rows } = await pool.query<CandidateRow>(sql, params);

  const ranked: TechnicianSummary[] = rows.map((r) => {
    const distanceKm = r.distance_m / 1000;
    const breakdown: RankBreakdown = rank({
      distanceKm,
      maxDistanceKm: q.radiusKm,
      ratingSum: r.rating_sum,
      ratingCount: r.rating_count,
      jobsOffered: r.jobs_offered,
      jobsAccepted: r.jobs_accepted,
      experienceYears: r.experience_years,
    });
    return {
      id: r.id,
      fullName: r.full_name,
      avatarUrl: r.avatar_url,
      areaLabel: r.area_label,
      experienceYears: r.experience_years,
      hourlyRateBdt: r.hourly_rate_bdt,
      distanceKm: Math.round(distanceKm * 100) / 100,
      lat: r.lat,
      lng: r.lng,
      ratingAvg: r.rating_count ? Math.round((r.rating_sum / r.rating_count) * 10) / 10 : null,
      ratingCount: r.rating_count,
      jobsCompleted: r.jobs_completed,
      categories: r.categories,
      rank: breakdown,
    };
  });

  const sorters: Record<
    SearchQuery['sort'],
    (a: TechnicianSummary, b: TechnicianSummary) => number
  > = {
    best: (a, b) => b.rank.score - a.rank.score || a.distanceKm - b.distanceKm,
    distance: (a, b) => a.distanceKm - b.distanceKm,
    rating: (a, b) => b.rank.bayesianRating - a.rank.bayesianRating || a.distanceKm - b.distanceKm,
    price: (a, b) => a.hourlyRateBdt - b.hourlyRateBdt || b.rank.score - a.rank.score,
  };
  ranked.sort(sorters[q.sort]);

  const start = (q.page - 1) * q.pageSize;
  return {
    items: ranked.slice(start, start + q.pageSize),
    page: q.page,
    pageSize: q.pageSize,
    total: ranked.length,
  };
}

export async function getTechnicianProfile(id: string, opts: { includeUnverified?: boolean } = {}) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name AS "fullName", u.avatar_url AS "avatarUrl", u.created_at AS "memberSince",
            t.bio, t.experience_years AS "experienceYears", t.hourly_rate_bdt AS "hourlyRateBdt",
            t.area_label AS "areaLabel", t.service_radius_km AS "serviceRadiusKm",
            t.is_verified AS "isVerified", t.is_available AS "isAvailable",
            ST_Y(t.location::geometry) AS lat, ST_X(t.location::geometry) AS lng,
            t.rating_sum AS "ratingSum", t.rating_count AS "ratingCount",
            t.jobs_offered AS "jobsOffered", t.jobs_accepted AS "jobsAccepted",
            t.jobs_completed AS "jobsCompleted",
            COALESCE(json_agg(json_build_object('id', c.id, 'slug', c.slug, 'name', c.name))
                     FILTER (WHERE c.id IS NOT NULL), '[]') AS categories
       FROM technician_profiles t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN technician_services ts ON ts.technician_id = t.user_id
       LEFT JOIN service_categories c ON c.id = ts.category_id
      WHERE t.user_id = $1 AND u.is_active
      GROUP BY u.id, t.user_id`,
    [id],
  );
  const p = rows[0];
  if (!p || (!p.isVerified && !opts.includeUnverified)) throw notFound('Technician');

  const reviews = await pool.query(
    `SELECT r.rating, r.comment, r.created_at AS "createdAt", -- Public page: first name + last initial only ("Rahim U.").
            trim(split_part(u.full_name, ' ', 1) || ' ' ||
                 COALESCE(NULLIF(left(split_part(u.full_name, ' ', 2), 1), '') || '.', '')) AS "customerName"
       FROM reviews r JOIN users u ON u.id = r.customer_id
      WHERE r.technician_id = $1 ORDER BY r.created_at DESC LIMIT 10`,
    [id],
  );
  const { ratingSum, ratingCount, jobsOffered, jobsAccepted, ...rest } = p;
  return {
    ...rest,
    ratingAvg: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    ratingCount,
    acceptanceRate: jobsOffered ? Math.round((jobsAccepted / jobsOffered) * 100) / 100 : null,
    recentReviews: reviews.rows,
  };
}

export const UpdateTechnicianProfileBody = z
  .object({
    bio: z.string().max(1000).nullable(),
    experienceYears: z.number().int().min(0).max(60),
    hourlyRateBdt: z.number().int().min(100).max(100000),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    areaLabel: z.string().max(100).nullable(),
    serviceRadiusKm: z.number().min(1).max(100),
    isAvailable: z.boolean(),
    categoryIds: z.array(z.number().int().positive()).min(1).max(10),
  })
  .partial()
  .refine((b) => (b.lat === undefined) === (b.lng === undefined), {
    message: 'lat and lng must be updated together',
    path: ['lng'],
  })
  .meta({ id: 'UpdateTechnicianProfile' });

export async function updateTechnicianProfile(
  userId: string,
  body: z.infer<typeof UpdateTechnicianProfileBody>,
) {
  await withTransaction(async (tx) => {
    const sets: string[] = [];
    const params: unknown[] = [userId];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (body.bio !== undefined) add('bio', body.bio);
    if (body.experienceYears !== undefined) add('experience_years', body.experienceYears);
    if (body.hourlyRateBdt !== undefined) add('hourly_rate_bdt', body.hourlyRateBdt);
    if (body.areaLabel !== undefined) add('area_label', body.areaLabel);
    if (body.serviceRadiusKm !== undefined) add('service_radius_km', body.serviceRadiusKm);
    if (body.isAvailable !== undefined) add('is_available', body.isAvailable);
    if (body.lat !== undefined && body.lng !== undefined) {
      params.push(body.lng, body.lat);
      sets.push(
        `location = ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length}), 4326)::geography`,
      );
    }
    if (sets.length) {
      const res = await tx.query(
        `UPDATE technician_profiles SET ${sets.join(', ')} WHERE user_id = $1`,
        params,
      );
      if (res.rowCount === 0) throw notFound('Technician profile');
    }
    if (body.categoryIds) {
      await tx.query('DELETE FROM technician_services WHERE technician_id = $1', [userId]);
      try {
        await tx.query(
          `INSERT INTO technician_services (technician_id, category_id)
           SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
          [userId, body.categoryIds],
        );
      } catch (err) {
        if (pgCode(err) === PgError.FOREIGN_KEY_VIOLATION)
          throw badRequest('Unknown service category');
        throw err;
      }
    }
  });
  return getTechnicianProfile(userId, { includeUnverified: true });
}
