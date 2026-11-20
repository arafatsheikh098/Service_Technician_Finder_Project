/**
 * Demo data: service categories, ~60 technicians across Chattogram and Dhaka with
 * realistic coordinates, demo accounts, and a history of completed jobs with
 * reviews so ranking has something to work with.
 *
 *   npm run db:seed   (in production also needs --force and SEED_CONFIRM=erase-all-data)
 *
 * Deterministic: the same seed always produces the same data.
 */
import bcrypt from 'bcryptjs';
import { isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { pool, withTransaction } from './pool.js';
import { migrate } from './migrator.js';

export const DEMO_PASSWORD = 'Demo@12345';
export const DEMO_ACCOUNTS = {
  admin: 'admin@techfinder.dev',
  customer: 'customer@techfinder.dev',
  technician: 'technician@techfinder.dev',
};

export const CATEGORIES = [
  {
    slug: 'electrician',
    name: 'Electrician',
    nameBn: 'ইলেকট্রিশিয়ান',
    price: 500,
    desc: 'Wiring, switches, sockets, fans, lights, breakers',
  },
  {
    slug: 'plumber',
    name: 'Plumber',
    nameBn: 'প্লাম্বার',
    price: 500,
    desc: 'Leaks, taps, pipes, drains, toilets, water pumps',
  },
  {
    slug: 'ac-repair',
    name: 'AC Repair & Servicing',
    nameBn: 'এসি সার্ভিসিং',
    price: 1200,
    desc: 'AC servicing, gas refill, installation, not cooling',
  },
  {
    slug: 'appliance-repair',
    name: 'Appliance Repair',
    nameBn: 'হোম অ্যাপ্লায়েন্স মেরামত',
    price: 800,
    desc: 'Fridge, washing machine, microwave, oven',
  },
  {
    slug: 'carpenter',
    name: 'Carpenter',
    nameBn: 'কাঠমিস্ত্রি',
    price: 600,
    desc: 'Doors, locks, furniture repair and assembly',
  },
  {
    slug: 'painter',
    name: 'Painter',
    nameBn: 'রং মিস্ত্রি',
    price: 1500,
    desc: 'Interior and exterior painting, damp walls',
  },
  {
    slug: 'cleaning',
    name: 'Home Cleaning',
    nameBn: 'পরিষ্কার-পরিচ্ছন্নতা',
    price: 1000,
    desc: 'Deep cleaning, sofa and carpet cleaning',
  },
  {
    slug: 'pest-control',
    name: 'Pest Control',
    nameBn: 'পেস্ট কন্ট্রোল',
    price: 1500,
    desc: 'Cockroaches, termites, bed bugs, rodents',
  },
  {
    slug: 'computer-repair',
    name: 'Computer Repair',
    nameBn: 'কম্পিউটার মেরামত',
    price: 700,
    desc: 'Laptop and desktop repair, OS install, virus removal',
  },
  {
    slug: 'cctv-installation',
    name: 'CCTV Installation',
    nameBn: 'সিসিটিভি ইনস্টলেশন',
    price: 1500,
    desc: 'Security camera installation and setup',
  },
];

const AREAS = [
  // Chattogram
  { label: 'Agrabad, Chattogram', lat: 22.3253, lng: 91.8124 },
  { label: 'GEC Circle, Chattogram', lat: 22.359, lng: 91.8215 },
  { label: 'Nasirabad, Chattogram', lat: 22.3667, lng: 91.824 },
  { label: 'Halishahar, Chattogram', lat: 22.3236, lng: 91.7787 },
  { label: 'Chawkbazar, Chattogram', lat: 22.3475, lng: 91.838 },
  { label: 'Panchlaish, Chattogram', lat: 22.362, lng: 91.833 },
  { label: 'Khulshi, Chattogram', lat: 22.36, lng: 91.805 },
  { label: 'Bahaddarhat, Chattogram', lat: 22.368, lng: 91.849 },
  { label: 'Muradpur, Chattogram', lat: 22.37, lng: 91.837 },
  { label: 'Hathazari (CU), Chattogram', lat: 22.471, lng: 91.786 },
  // Dhaka
  { label: 'Dhanmondi, Dhaka', lat: 23.7461, lng: 90.3742 },
  { label: 'Gulshan, Dhaka', lat: 23.7925, lng: 90.4078 },
  { label: 'Mirpur, Dhaka', lat: 23.8223, lng: 90.3654 },
  { label: 'Uttara, Dhaka', lat: 23.8759, lng: 90.3795 },
  { label: 'Mohammadpur, Dhaka', lat: 23.7662, lng: 90.3589 },
  { label: 'Bashundhara, Dhaka', lat: 23.8193, lng: 90.4526 },
];

const FIRST = [
  'Rahim',
  'Karim',
  'Jamal',
  'Kamal',
  'Shafiq',
  'Rafiq',
  'Habib',
  'Nasir',
  'Sohel',
  'Mizan',
  'Babul',
  'Alamgir',
  'Shahin',
  'Faruk',
  'Jahid',
  'Rubel',
  'Arif',
  'Tanvir',
  'Imran',
  'Sabbir',
  'Nusrat',
  'Shirin',
  'Taslima',
  'Rokeya',
];
const LAST = [
  'Uddin',
  'Hossain',
  'Ahmed',
  'Chowdhury',
  'Islam',
  'Miah',
  'Rahman',
  'Sarker',
  'Khan',
  'Talukder',
  'Bhuiyan',
  'Molla',
];
const COMMENTS = [
  'Came on time and fixed it quickly. Recommended!',
  'Very professional, explained the problem clearly.',
  'Good work, fair price.',
  'Solved the issue in one visit.',
  'A bit late but the work quality was good.',
  'খুব ভালো কাজ করেছেন, ধন্যবাদ।',
  'Polite and clean work.',
  'Had to call again for a follow-up, but resolved in the end.',
  null,
];

// Small deterministic PRNG (mulberry32) so the seed is reproducible.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seed() {
  // The seed TRUNCATES every table. In production it needs two explicit confirmations.
  if (
    isProd &&
    !(process.argv.includes('--force') && process.env.SEED_CONFIRM === 'erase-all-data')
  ) {
    throw new Error(
      'Refusing to seed in production. This erases ALL data. Set SEED_CONFIRM=erase-all-data and pass --force.',
    );
  }
  await migrate(pool);
  const rand = rng(42);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await withTransaction(async (tx) => {
    await tx.query(`TRUNCATE users, service_categories RESTART IDENTITY CASCADE`);

    for (const c of CATEGORIES) {
      await tx.query(
        `INSERT INTO service_categories (slug, name, name_bn, description, base_price_bdt) VALUES ($1, $2, $3, $4, $5)`,
        [c.slug, c.name, c.nameBn, c.desc, c.price],
      );
    }

    const insertUser = async (email: string, name: string, role: string, phone: string | null) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, full_name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [email, hash, name, phone, role],
      );
      return rows[0]!.id;
    };

    await insertUser(DEMO_ACCOUNTS.admin, 'Platform Admin', 'admin', null);
    const customerIds = [
      await insertUser(DEMO_ACCOUNTS.customer, 'Demo Customer', 'customer', '01711000000'),
    ];
    for (let i = 1; i <= 15; i++) {
      customerIds.push(
        await insertUser(
          `customer${i}@example.com`,
          `${pick(FIRST)} ${pick(LAST)}`,
          'customer',
          `0181${String(1000000 + i)}`,
        ),
      );
    }

    const techIds: string[] = [];
    for (let i = 0; i < 60; i++) {
      const isDemo = i === 0;
      const area = isDemo ? AREAS[0]! : AREAS[i % AREAS.length]!;
      const email = isDemo ? DEMO_ACCOUNTS.technician : `tech${i}@example.com`;
      const name = isDemo ? 'Demo Technician' : `${pick(FIRST)} ${pick(LAST)}`;
      const id = await insertUser(email, name, 'technician', `0191${String(1000000 + i)}`);
      // Scatter around the area centre (~±1 km). The demo technician gets a fixed,
      // on-land spot near Agrabad so demos look right.
      const lat = isDemo ? 22.339 : area.lat + (rand() - 0.5) * 0.018;
      const lng = isDemo ? 91.816 : area.lng + (rand() - 0.5) * 0.018;
      const exp = Math.floor(rand() * 15);
      await tx.query(
        `INSERT INTO technician_profiles (user_id, bio, experience_years, hourly_rate_bdt, location, area_label,
                                          service_radius_km, is_verified)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8, $9)`,
        [
          id,
          `${exp}+ years of hands-on experience. Honest pricing, clean work, and I clean up after the job.`,
          exp,
          300 + Math.round(rand() * 14) * 50,
          lng,
          lat,
          area.label,
          5 + Math.round(rand() * 15),
          // A few unverified technicians so the admin verification queue isn't empty.
          isDemo || i % 12 !== 11,
        ],
      );
      const nCats = 1 + Math.floor(rand() * 3);
      const cats = new Set<number>(isDemo ? [1, 2] : []);
      while (cats.size < nCats) cats.add(1 + Math.floor(rand() * CATEGORIES.length));
      for (const c of cats) {
        await tx.query(
          'INSERT INTO technician_services (technician_id, category_id) VALUES ($1, $2)',
          [id, c],
        );
      }
      techIds.push(id);
    }

    // Past jobs: completed (with reviews), some cancelled/rejected, so stats and
    // acceptance rates look like a real marketplace.
    for (const techId of techIds) {
      const quality = 0.55 + rand() * 0.45; // some technicians are better than others
      const jobs = Math.floor(rand() * 14);
      const { rows: cats } = await tx.query<{ category_id: number }>(
        'SELECT category_id FROM technician_services WHERE technician_id = $1',
        [techId],
      );
      const { rows: loc } = await tx.query<{ lat: number; lng: number; area: string }>(
        `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, area_label AS area
           FROM technician_profiles WHERE user_id = $1`,
        [techId],
      );
      let offered = 0;
      let accepted = 0;
      let completed = 0;
      for (let j = 0; j < jobs; j++) {
        // Skewed towards recent weeks, so the admin activity chart looks like real growth.
        const hoursAgo = 30 + Math.floor(rand() * rand() * 60 * 24);
        const outcome = rand();
        const status = outcome < 0.78 ? 'completed' : outcome < 0.9 ? 'cancelled' : 'rejected';
        const customerId = pick(customerIds);
        const price = 500 + Math.round(rand() * 30) * 50;
        const { rows } = await tx.query<{ id: string }>(
          `INSERT INTO bookings (customer_id, technician_id, category_id, status, slot, address, location,
                                 problem_description, quoted_price_bdt, created_at, cancel_reason)
           VALUES ($1, $2, $3, $4,
                   tstzrange(now() - make_interval(hours => $5), now() - make_interval(hours => $5 - 2), '[)'),
                   $6, ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, $9, $10,
                   now() - make_interval(hours => $5 + 24), $11)
           RETURNING id`,
          [
            customerId,
            techId,
            pick(cats).category_id,
            status,
            hoursAgo,
            `House ${1 + Math.floor(rand() * 90)}, Road ${1 + Math.floor(rand() * 20)}, ${loc[0]!.area}`,
            loc[0]!.lng + (rand() - 0.5) * 0.02,
            loc[0]!.lat + (rand() - 0.5) * 0.02,
            'Seeded historical job',
            price,
            status === 'cancelled' ? 'Customer changed plans' : null,
          ],
        );
        offered++;
        if (status !== 'rejected') accepted++;
        if (status === 'completed') {
          completed++;
          // Most completed jobs were paid through the gateway.
          if (rand() < 0.9) {
            await tx.query(
              `INSERT INTO payments (booking_id, amount_bdt, status, provider, provider_ref, created_at, updated_at)
               VALUES ($1, $2, 'succeeded', 'mockpay', $3, now() - make_interval(hours => $4), now() - make_interval(hours => $4))`,
              [rows[0]!.id, price, `seed_${rows[0]!.id}`, hoursAgo - 2],
            );
          }
          if (rand() < 0.85) {
            const rating = Math.max(
              1,
              Math.min(5, Math.round(1 + quality * 4 + (rand() - 0.5) * 1.5)),
            );
            await tx.query(
              `INSERT INTO reviews (booking_id, customer_id, technician_id, rating, comment, created_at)
               VALUES ($1, $2, $3, $4, $5, now() - make_interval(hours => $6))`,
              [rows[0]!.id, customerId, techId, rating, pick(COMMENTS), hoursAgo - 3],
            );
          }
        }
      }
      await tx.query(
        `UPDATE technician_profiles SET jobs_offered = $2, jobs_accepted = $3, jobs_completed = $4 WHERE user_id = $1`,
        [techId, offered, accepted, completed],
      );
    }

    // Upcoming work for the demo accounts, so their dashboards have something to show.
    // Slots are on the next two days (UTC hours chosen not to clash with the test suite,
    // which books days 3+).
    const demoTech = techIds[0]!;
    const demoCustomer = customerIds[0]!;
    const otherTech = techIds[16]!; // another verified technician based in Agrabad
    const upcoming: {
      customer: string;
      tech: string;
      category: number;
      day: number;
      hour: number;
      status: 'pending' | 'accepted';
      problem: string;
      address: string;
      price: number;
    }[] = [
      {
        customer: demoCustomer,
        tech: otherTech,
        category: 0,
        day: 1,
        hour: 6,
        status: 'accepted',
        problem: 'Kitchen tap keeps dripping and the sink drains slowly.',
        address: 'House 7, Road 2, Agrabad C/A',
        price: 1100,
      },
      {
        customer: customerIds[3]!,
        tech: demoTech,
        category: 2,
        day: 1,
        hour: 4,
        status: 'pending',
        problem: 'Water leaking under the kitchen cabinet.',
        address: 'Flat 3B, Road 5, Agrabad',
        price: 1800,
      },
      {
        customer: customerIds[5]!,
        tech: demoTech,
        category: 1,
        day: 1,
        hour: 10,
        status: 'pending',
        problem: 'Two switches in the bedroom spark when turned on.',
        address: 'House 21, Lane 4, Chowmuhani',
        price: 1800,
      },
      {
        customer: customerIds[7]!,
        tech: demoTech,
        category: 1,
        day: 2,
        hour: 8,
        status: 'accepted',
        problem: 'Install three new ceiling lights in the living room.',
        address: 'House 9, Road 1, Badamtoli',
        price: 2700,
      },
    ];
    for (const u of upcoming) {
      const cat = u.category
        ? u.category
        : (
            await tx.query<{ category_id: number }>(
              'SELECT category_id FROM technician_services WHERE technician_id = $1 LIMIT 1',
              [u.tech],
            )
          ).rows[0]!.category_id;
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO bookings (customer_id, technician_id, category_id, status, slot, address, location, problem_description, quoted_price_bdt)
         VALUES ($1, $2, $3, $4,
                 tstzrange(date_trunc('day', now()) + make_interval(days => $5, hours => $6),
                           date_trunc('day', now()) + make_interval(days => $5, hours => $6 + 2), '[)'),
                 $7, ST_SetSRID(ST_MakePoint(91.8124 + $8, 22.3253 + $8), 4326)::geography, $9, $10)
         RETURNING id`,
        [
          u.customer,
          u.tech,
          cat,
          u.status,
          u.day,
          u.hour,
          u.address,
          (rand() - 0.5) * 0.01,
          u.problem,
          u.price,
        ],
      );
      const id = rows[0]!.id;
      await tx.query(
        `INSERT INTO booking_events (booking_id, from_status, to_status, actor_id, created_at)
         VALUES ($1, NULL, 'pending', $2, now() - interval '3 hours')`,
        [id, u.customer],
      );
      await tx.query(
        'UPDATE technician_profiles SET jobs_offered = jobs_offered + 1 WHERE user_id = $1',
        [u.tech],
      );
      if (u.status === 'accepted') {
        await tx.query(
          `INSERT INTO booking_events (booking_id, from_status, to_status, actor_id, created_at)
           VALUES ($1, 'pending', 'accepted', $2, now() - interval '2 hours')`,
          [id, u.tech],
        );
        await tx.query(
          'UPDATE technician_profiles SET jobs_accepted = jobs_accepted + 1 WHERE user_id = $1',
          [u.tech],
        );
        await tx.query(
          `INSERT INTO messages (booking_id, sender_id, body, created_at) VALUES
             ($1, $2, 'Assalamu alaikum! I have accepted your booking and will bring the parts.', now() - interval '110 minutes'),
             ($1, $3, 'Thank you! The gate code is 2468.', now() - interval '100 minutes')`,
          [id, u.tech, u.customer],
        );
      }
    }
  });

  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM bookings) AS bookings,
            (SELECT count(*) FROM reviews) AS reviews`,
  );
  return rows[0] as { users: number; bookings: number; reviews: number };
}

// Run directly: `tsx src/db/seed.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const counts = await seed();
    logger.info(counts, `Seeded. Demo password for all accounts: ${DEMO_PASSWORD}`);
    logger.info(DEMO_ACCOUNTS, 'Demo accounts');
  } catch (err) {
    logger.fatal({ err }, 'Seed failed');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
