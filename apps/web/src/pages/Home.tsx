import { useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion, useScroll, useTransform } from 'motion/react';
import clsx from 'clsx';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  MapPin,
  MessageCircle,
  Navigation,
  Quote,
  Radar,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { taka } from '../lib/format';
import { PRESET_LOCATIONS, loadSavedLocation } from '../lib/geo';
import type { Category, Page, TechnicianSummary } from '../lib/types';
import { Avatar, Skeleton, Stars, Verified } from '../components/ui';
import { CategoryIcon, categoryStyle } from '../components/categories';
import { HeroSearch, LivePreview } from '../components/HomeHero';
import {
  Aurora,
  CountUp,
  EASE,
  Magnetic,
  Marquee,
  Reveal,
  RotatingWords,
  SplitWords,
  Stagger,
  StaggerItem,
  Tilt,
} from '../components/motion';
import { ChatDemo, RadarDemo, RatingDemo, SlotRaceDemo, StatusDemo } from '../components/demos';

interface PublicStats {
  verifiedTechnicians: number;
  jobsCompleted: number;
  averageRating: number | null;
  reviews: number;
}
interface RecentReview {
  rating: number;
  comment: string;
  customerName: string;
  technicianName: string;
  category: string;
}

function SectionHeading({
  eyebrow,
  title,
  sub,
  dark,
  center,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
  dark?: boolean;
  center?: boolean;
}) {
  return (
    <Reveal className={clsx(center && 'mx-auto text-center', 'max-w-2xl')}>
      <p
        className={clsx(
          'text-sm font-bold uppercase tracking-[0.2em]',
          dark ? 'text-brand-300' : 'text-brand-600',
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={clsx(
          'mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl',
          dark ? 'text-white' : 'text-slate-900',
        )}
      >
        {title}
      </h2>
      {sub && (
        <p
          className={clsx(
            'mt-4 text-lg leading-relaxed',
            dark ? 'text-slate-400' : 'text-slate-500',
          )}
        >
          {sub}
        </p>
      )}
    </Reveal>
  );
}

function BentoTile({
  title,
  text,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  text: string;
  icon: typeof Star;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <StaggerItem
      className={clsx(
        'spotlight spotlight-dark group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/15 text-brand-300 ring-1 ring-brand-300/20">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
      <div className="mt-6 min-h-40 flex-1">{children}</div>
    </StaggerItem>
  );
}

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 55%'] });
  const fill = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const steps = [
    {
      icon: Sparkles,
      title: 'Describe or choose',
      text: 'Write the problem in Bangla or English, or pick a service. We match you with the right kind of pro.',
    },
    {
      icon: CalendarClock,
      title: 'Compare & book a slot',
      text: 'Verified technicians near you, ranked by rating, distance and reliability. Your slot is guaranteed.',
    },
    {
      icon: Navigation,
      title: 'Track, chat & pay',
      text: 'Follow your technician live on the map, chat in the app, then pay and review once it is fixed.',
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-28">
      <SectionHeading
        center
        eyebrow="How it works"
        title={
          <>
            From “it’s broken” to <span className="text-brand-600">fixed</span> in three steps
          </>
        }
      />
      <div ref={ref} className="relative mx-auto mt-16 max-w-3xl">
        <div className="absolute bottom-6 left-7 top-6 w-0.5 bg-slate-200 sm:left-1/2 sm:-translate-x-1/2" />
        <motion.div
          className="absolute left-7 top-6 w-0.5 bg-gradient-to-b from-brand-400 to-amber-300 sm:left-1/2 sm:-translate-x-1/2"
          style={{ height: fill }}
        />
        <div className="space-y-14">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={0.05}>
              <div
                className={clsx(
                  'relative flex items-center gap-6 sm:w-1/2',
                  i % 2 ? 'sm:ml-auto sm:pl-14' : 'sm:flex-row-reverse sm:pr-14 sm:text-right',
                )}
              >
                <span
                  className={clsx(
                    'relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-[var(--shadow-glow)] ring-8 ring-slate-50',
                    i % 2 ? 'sm:-ml-[5.25rem]' : 'sm:-mr-[5.25rem]',
                  )}
                >
                  <s.icon className="h-6 w-6" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-extrabold text-ink-900">
                    {i + 1}
                  </span>
                </span>
                <div className="card p-6">
                  <h3 className="text-xl font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-slate-500">{s.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = loadSavedLocation() ?? PRESET_LOCATIONS[0]!;
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const heroFade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const stats = useQuery({
    queryKey: ['public-stats'],
    queryFn: () => api<PublicStats>('/stats'),
    staleTime: 60_000,
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: Category[] }>('/categories').then((r) => r.items),
    staleTime: 300_000,
  });
  const reviews = useQuery({
    queryKey: ['recent-reviews'],
    queryFn: () => api<{ items: RecentReview[] }>('/reviews/recent').then((r) => r.items),
    staleTime: 120_000,
  });
  const topRated = useQuery({
    queryKey: ['top-rated', location.lat, location.lng],
    queryFn: () =>
      api<Page<TechnicianSummary>>(
        `/technicians?lat=${location.lat}&lng=${location.lng}&radiusKm=15&sort=best&pageSize=4`,
      ),
  });
  const goCategory = (slug: string) =>
    navigate(
      `/search?${new URLSearchParams({ lat: String(location.lat), lng: String(location.lng), category: slug })}`,
    );
  const cats = categories.data ?? [];

  return (
    <div className="overflow-x-clip">
      {/* ============ HERO ============ */}
      <section ref={heroRef} className="relative isolate overflow-hidden bg-ink-950 text-white">
        <Aurora />
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]" />
        <motion.div
          style={{ y: heroY, opacity: heroFade }}
          className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 pb-28 pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-36 lg:pt-24"
        >
          <div>
            <motion.span
              className="eyebrow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
              </span>
              Live now in Chattogram & Dhaka
            </motion.span>
            <h1 className="mt-6 text-[2.75rem] font-extrabold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-[3.15rem] xl:text-[3.45rem]">
              <SplitWords text="Book a trusted" delay={0.1} />
              <br />
              <RotatingWords
                words={['electrician', 'plumber', 'AC expert', 'carpenter', 'painter']}
                className="text-gradient"
              />
              <br />
              <SplitWords text="tracked to your door." delay={0.35} className="text-slate-300" />
            </h1>
            <motion.p
              className="mt-6 max-w-lg text-lg leading-relaxed text-slate-400"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
            >
              Verified pros, guaranteed time slots, live tracking and in-app chat. Pay only when the
              job is done.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
            >
              <HeroSearch />
            </motion.div>
            <motion.div
              className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <span className="flex -space-x-2">
                {['Rahim Uddin', 'Nusrat Miah', 'Karim Khan', 'Shirin Ahmed'].map((n) => (
                  <span key={n} className="rounded-full ring-2 ring-ink-950">
                    <Avatar name={n} size="sm" />
                  </span>
                ))}
              </span>
              {stats.data?.averageRating && (
                <span>
                  <b className="text-white">{stats.data.averageRating.toFixed(1)}★</b> from{' '}
                  <b className="text-white">{stats.data.reviews}</b> verified reviews
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-400" /> Pay after the job
              </span>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: EASE }}
          >
            <Tilt className="rounded-[2rem]" max={8}>
              <LivePreview />
            </Tilt>
          </motion.div>
        </motion.div>
        <motion.div
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-xs text-slate-500 lg:flex"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Scroll <ChevronDown className="h-4 w-4" />
        </motion.div>
      </section>

      {/* ============ STATS ============ */}
      <section className="relative z-10 mx-auto -mt-12 max-w-5xl px-4">
        <Reveal>
          <div className="card grid grid-cols-2 divide-slate-100 p-2 shadow-[var(--shadow-lift)] sm:grid-cols-4 sm:divide-x">
            {[
              [
                stats.data?.verifiedTechnicians,
                'Verified pros',
                (n: number) => Math.round(n).toString(),
              ],
              [
                stats.data?.jobsCompleted,
                'Jobs completed',
                (n: number) => Math.round(n).toLocaleString('en-IN'),
              ],
              [stats.data?.averageRating, 'Average rating', (n: number) => `${n.toFixed(1)}★`],
              [cats.length || undefined, 'Services', (n: number) => Math.round(n).toString()],
            ].map(([value, label, fmt]) => (
              <div key={label as string} className="px-4 py-5 text-center">
                <div className="text-4xl font-extrabold tracking-tight text-slate-900">
                  {typeof value === 'number' ? (
                    <CountUp value={value} format={fmt as (n: number) => string} />
                  ) : (
                    <Skeleton className="mx-auto h-9 w-16" />
                  )}
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                  {label as string}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ============ SERVICE MARQUEE ============ */}
      <section className="py-16">
        {cats.length > 0 && (
          <div className="space-y-4">
            {[cats, [...cats].reverse()].map((row, r) => (
              <Marquee key={r} reverse={r === 1} speed={45}>
                {row.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => goCategory(c.slug)}
                    className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white py-2.5 pl-2.5 pr-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[var(--shadow-lift)]"
                  >
                    <CategoryIcon slug={c.slug} />
                    <span className="text-left">
                      <span className="block text-sm font-bold text-slate-900">{c.name}</span>
                      <span className="block text-xs text-slate-500">
                        {c.nameBn} · from {taka(c.basePriceBdt)}
                      </span>
                    </span>
                  </button>
                ))}
              </Marquee>
            ))}
          </div>
        )}
      </section>

      {/* ============ SERVICES GRID ============ */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="Services" title="What needs fixing today?" />
          <Reveal>
            <Link to="/search" className="btn-secondary">
              Browse all technicians <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
        <Stagger className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.isLoading &&
            Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
          {cats.map((c) => (
            <StaggerItem key={c.id}>
              <motion.button
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => goCategory(c.slug)}
                className={clsx(
                  'card group flex h-full w-full flex-col items-start p-5 text-left ring-4 ring-transparent transition-shadow hover:shadow-[var(--shadow-lift)]',
                  categoryStyle(c.slug).ring,
                )}
              >
                <motion.span whileHover={{ rotate: -8, scale: 1.1 }}>
                  <CategoryIcon slug={c.slug} size="lg" />
                </motion.span>
                <span className="mt-4 font-bold leading-snug text-slate-900">{c.name}</span>
                {c.nameBn && <span className="text-xs text-slate-500">{c.nameBn}</span>}
                <span className="mt-auto flex w-full items-center justify-between pt-4 text-xs font-semibold text-slate-500">
                  From {taka(c.basePriceBdt)}
                  <ArrowRight className="h-4 w-4 -translate-x-2 text-brand-600 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                </span>
              </motion.button>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ============ TOP RATED ============ */}
      <section className="mx-auto max-w-6xl px-4 pt-28">
        <SectionHeading
          eyebrow={`Near ${location.label.split(',')[0]}`}
          title="Top-rated pros around you"
          sub="Ranked by a fair score: rating adjusted for review count, distance, reliability and experience."
        />
        <Stagger className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {topRated.isLoading &&
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          {topRated.data?.items.map((t, i) => (
            <StaggerItem key={t.id}>
              <Link
                to={`/technicians/${t.id}`}
                className="card group block h-full overflow-hidden transition hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]"
              >
                <div className="relative h-20 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-700 to-ink-900">
                  <div className="bg-grid absolute inset-0 opacity-50" />
                  {i === 0 && (
                    <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-extrabold text-ink-900">
                      #1 match
                    </span>
                  )}
                </div>
                <div className="-mt-9 px-5 pb-5">
                  <Avatar name={t.fullName} url={t.avatarUrl} size="lg" ring />
                  <div className="mt-3 flex items-center gap-1 font-bold text-slate-900">
                    {t.fullName} <Verified className="h-4 w-4" />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" /> {t.distanceKm} km · {t.areaLabel?.split(',')[0]}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Stars value={t.ratingAvg} count={t.ratingCount} />
                    <span className="font-extrabold">
                      {taka(t.hourlyRateBdt)}
                      <span className="text-xs font-medium text-slate-500">/hr</span>
                    </span>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${t.rank.score * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.1, delay: 0.2 + i * 0.1, ease: EASE }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-400">
                    Match score {Math.round(t.rank.score * 100)}
                  </div>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ============ BENTO: LIVE DEMOS ============ */}
      <section className="relative isolate mt-28 overflow-hidden bg-ink-950 py-28">
        <Aurora className="opacity-60" />
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
        <div className="relative mx-auto max-w-6xl px-4">
          <SectionHeading
            dark
            center
            eyebrow="Built different"
            title={
              <>
                Not just a directory.
                <br />
                <span className="text-gradient">A service that works for you.</span>
              </>
            }
            sub="Everything below is running live: the same behaviour you get in the app."
          />
          <Stagger className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6" gap={0.1}>
            <BentoTile
              className="md:col-span-3"
              icon={MessageCircle}
              title="Chat with your technician"
              text="Share gate codes and directions. Messages are saved with the booking."
            >
              <ChatDemo />
            </BentoTile>
            <BentoTile
              className="md:col-span-3"
              icon={Radar}
              title="Pros near you, instantly"
              text="Geo search finds verified technicians whose service area covers your address."
            >
              <RadarDemo />
            </BentoTile>
            <BentoTile
              className="md:col-span-3"
              icon={CalendarClock}
              title="Your slot is guaranteed"
              text="Ten people can book the same time at once. Exactly one gets it: enforced by the database."
            >
              <SlotRaceDemo />
            </BentoTile>
            <BentoTile
              className="md:col-span-3"
              icon={Star}
              title="Ratings you can trust"
              text="Reviews only come from real, completed bookings."
            >
              <RatingDemo />
            </BentoTile>
            <BentoTile
              className="md:col-span-6"
              icon={Navigation}
              title="Know exactly what's happening"
              text="Every booking moves through clear steps, and you're notified at each one in real time."
            >
              <StatusDemo />
            </BentoTile>
          </Stagger>
        </div>
      </section>

      <HowItWorks />

      {/* ============ REVIEWS ============ */}
      {reviews.data && reviews.data.length > 0 && (
        <section className="pb-28">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeading center eyebrow="Reviews" title="Loved across Chattogram & Dhaka" />
          </div>
          <div className="mt-12 space-y-4">
            {[reviews.data, [...reviews.data].reverse()].map((row, r) => (
              <Marquee key={r} reverse={r === 1} speed={60}>
                {row.map((rv, i) => (
                  <figure key={i} className="card w-80 shrink-0 p-5">
                    <Quote className="h-5 w-5 text-brand-300" />
                    <blockquote className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-700">
                      {rv.comment}
                    </blockquote>
                    <figcaption className="mt-4 flex items-center gap-3">
                      <Avatar name={rv.customerName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold">{rv.customerName}</div>
                        <div className="truncate text-xs text-slate-500">
                          {rv.category} · {rv.technicianName}
                        </div>
                      </div>
                      <span className="flex">
                        {Array.from({ length: rv.rating }, (_, k) => (
                          <Star key={k} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </Marquee>
            ))}
          </div>
        </section>
      )}

      {/* ============ CTA ============ */}
      <section className="mx-auto max-w-6xl px-4 pb-28">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[2.5rem] bg-ink-950 px-8 py-20 text-center text-white sm:px-16">
            <Aurora />
            <div className="bg-grid absolute inset-0 opacity-50" />
            <div className="relative">
              <h2 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight text-white sm:text-6xl">
                Something broken? <span className="text-gradient">Let’s fix it today.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-slate-400">
                Verified technicians are a few taps away. Book in under a minute and pay only when
                it’s done.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Magnetic>
                  <span className="glow-border inline-block rounded-2xl p-[2px] shadow-[0_0_40px_-8px_rgb(52_195_166/0.6)]">
                    <Link
                      to="/search"
                      className="inline-flex items-center gap-2 rounded-[14px] bg-white px-7 py-4 text-base font-extrabold text-ink-950 transition hover:bg-brand-50"
                    >
                      Find a technician <ArrowRight className="h-5 w-5" />
                    </Link>
                  </span>
                </Magnetic>
                {user?.role !== 'technician' && (
                  <Magnetic>
                    <Link
                      to="/register?role=technician"
                      className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-7 py-4 text-base font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15"
                    >
                      <BadgeCheck className="h-5 w-5 text-brand-300" /> Join as a technician
                    </Link>
                  </Magnetic>
                )}
              </div>
              <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-brand-400" /> Verified pros only
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-brand-400" /> Guaranteed slots
                </span>
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-brand-400" /> Pay after the job
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
