import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { motion } from 'motion/react';
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  Clock,
  MapPin,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../lib/api';
import { taka } from '../lib/format';
import { PRESET_LOCATIONS, loadSavedLocation } from '../lib/geo';
import type { Category, Page, TechnicianSummary } from '../lib/types';
import {
  Avatar,
  Empty,
  ErrorBox,
  ScoreRing,
  Skeleton,
  Spinner,
  Stars,
  Verified,
} from '../components/ui';
import { CategoryIcon } from '../components/categories';
import { ResultsMap } from '../components/maps';

function RankWhy({ t }: { t: TechnicianSummary }) {
  const rows: [string, number][] = [
    ['Rating', t.rank.components.rating],
    ['Distance', t.rank.components.proximity],
    ['Reliability', t.rank.components.reliability],
    ['Experience', t.rank.components.experience],
  ];
  return (
    <details className="group mt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-700">
        Why this match? <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
        {rows.map(([label, v]) => (
          <div key={label}>
            <div className="flex justify-between text-[11px] font-semibold text-slate-500">
              <span>{label}</span>
              <span className="text-slate-700">{Math.round(v * 100)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-200">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                style={{ width: `${v * 100}%` }}
              />
            </div>
          </div>
        ))}
        <p className="col-span-full text-[11px] text-slate-500">
          Rating is adjusted for review count ({t.rank.bayesianRating.toFixed(2)}★), so a few
          reviews count for less than many.
        </p>
      </div>
    </details>
  );
}

function ResultSkeleton() {
  return (
    <div className="card flex gap-4 p-5">
      <Skeleton className="h-14 w-14 rounded-full" />
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-12 w-12 rounded-full" />
    </div>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const saved = loadSavedLocation() ?? PRESET_LOCATIONS[0]!;
  const lat = Number(params.get('lat') ?? saved.lat);
  const lng = Number(params.get('lng') ?? saved.lng);
  const category = params.get('category') ?? '';
  const radiusKm = Number(params.get('radiusKm') ?? 10);
  const sort = params.get('sort') ?? 'best';
  const date = params.get('date') ?? '';
  const time = params.get('time') ?? '10:00';
  const [highlight, setHighlight] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  // Availability filter: a 2-hour window from the chosen date/time (Dhaka time, UTC+6).
  const slotStart = date ? new Date(`${date}T${time}:00+06:00`) : null;

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: Category[] }>('/categories').then((r) => r.items),
    staleTime: 5 * 60_000,
  });

  const query = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(radiusKm),
    sort,
    pageSize: '30',
  });
  if (category) query.set('category', category);
  if (slotStart) {
    query.set('from', slotStart.toISOString());
    query.set('to', new Date(slotStart.getTime() + 2 * 3600_000).toISOString());
  }
  const results = useQuery({
    queryKey: ['search', query.toString()],
    queryFn: () => api<Page<TechnicianSummary>>(`/technicians?${query}`),
    placeholderData: keepPreviousData,
  });

  const bookParams = new URLSearchParams();
  if (category) bookParams.set('category', category);
  if (date) bookParams.set('date', date);
  if (time) bookParams.set('time', time);
  const locationLabel = PRESET_LOCATIONS.find((p) => p.lat === lat && p.lng === lng)?.label;
  const categoryName = categories.data?.find((c) => c.slug === category)?.name;

  return (
    <div>
      {/* Filter bar */}
      <div className="sticky top-16 z-[400] border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-[var(--shadow-soft)]">
              <MapPin className="h-4 w-4 text-brand-600" />
              <select
                className="bg-transparent outline-none"
                value={locationLabel ?? ''}
                onChange={(e) => {
                  const p = PRESET_LOCATIONS.find((x) => x.label === e.target.value);
                  if (p) update({ lat: String(p.lat), lng: String(p.lng) });
                }}
              >
                {!locationLabel && <option value="">Custom location</option>}
                {PRESET_LOCATIONS.map((p) => (
                  <option key={p.label}>{p.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-[var(--shadow-soft)]">
              <CalendarDays className="h-4 w-4 text-brand-600" />
              <input
                type="date"
                className="bg-transparent outline-none"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => update({ date: e.target.value })}
              />
            </label>
            {date && (
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-[var(--shadow-soft)]">
                <Clock className="h-4 w-4 text-brand-600" />
                <input
                  type="time"
                  step={1800}
                  className="bg-transparent outline-none"
                  value={time}
                  onChange={(e) => update({ time: e.target.value })}
                />
              </label>
            )}
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-[var(--shadow-soft)]">
              <span className="text-slate-500">Sort</span>
              <select
                className="bg-transparent outline-none"
                value={sort}
                onChange={(e) => update({ sort: e.target.value })}
              >
                <option value="best">Best match</option>
                <option value="distance">Nearest</option>
                <option value="rating">Highest rated</option>
                <option value="price">Lowest price</option>
              </select>
            </label>
            <button
              className={clsx('btn-secondary py-2', showMore && 'border-brand-300 text-brand-700')}
              onClick={() => setShowMore(!showMore)}
            >
              <SlidersHorizontal className="h-4 w-4" /> {radiusKm} km
            </button>
            {results.isFetching && <Spinner className="h-4 w-4 text-brand-600" />}
          </div>
          {showMore && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-sm font-semibold text-slate-600">Search radius</span>
              <input
                type="range"
                min={1}
                max={30}
                value={radiusKm}
                onChange={(e) => update({ radiusKm: e.target.value })}
                className="flex-1 accent-brand-600"
              />
              <span className="w-14 text-right text-sm font-bold">{radiusKm} km</span>
            </div>
          )}
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => update({ category: '' })}
              className={clsx(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                !category
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              All services
            </button>
            {categories.data?.map((c) => (
              <button
                key={c.slug}
                onClick={() => update({ category: c.slug })}
                className={clsx(
                  'flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3.5 text-sm font-semibold transition',
                  category === c.slug
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                <CategoryIcon slug={c.slug} size="sm" /> {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-extrabold">
              {categoryName ? `${categoryName}s` : 'Technicians'} near{' '}
              {locationLabel?.split(',')[0] ?? 'you'}
            </h1>
            <p className="text-sm text-slate-500">
              {results.data
                ? `${results.data.total} verified ${results.data.total === 1 ? 'pro' : 'pros'} within ${radiusKm} km`
                : 'Searching…'}
              {slotStart &&
                ` · free on ${slotStart.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`}
            </p>
          </div>
          <ErrorBox error={results.error} />
          {results.isLoading && Array.from({ length: 4 }, (_, i) => <ResultSkeleton key={i} />)}
          {results.data?.items.length === 0 && (
            <Empty icon={<SearchX className="h-8 w-8" />} title="No technicians match">
              Try a bigger radius, another time, or a different service.
            </Empty>
          )}
          {results.data?.items.map((t, i) => (
            <motion.article
              key={t.id}
              layout
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: Math.min(i, 8) * 0.05,
                ease: [0.22, 1, 0.36, 1],
                layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              }}
              className={clsx(
                'card p-5 transition-shadow',
                highlight === t.id
                  ? 'border-brand-300 shadow-[var(--shadow-lift)] ring-4 ring-brand-100'
                  : 'hover:shadow-[var(--shadow-lift)]',
              )}
              onMouseEnter={() => setHighlight(t.id)}
            >
              <div className="flex gap-4">
                <Avatar name={t.fullName} url={t.avatarUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/technicians/${t.id}?${bookParams}`}
                        className="flex items-center gap-1 text-lg font-bold text-slate-900 hover:text-brand-700"
                      >
                        <span className="truncate">{t.fullName}</span>{' '}
                        <Verified className="h-[18px] w-[18px]" />
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                        <Stars value={t.ratingAvg} count={t.ratingCount} />
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {t.distanceKm} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5" /> {t.jobsCompleted} jobs ·{' '}
                          {t.experienceYears} yrs
                        </span>
                      </div>
                    </div>
                    {sort === 'best' && <ScoreRing value={t.rank.score} />}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.categories.map((c) => (
                      <span
                        key={c}
                        className={clsx(
                          'chip',
                          c === category && 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
                        )}
                      >
                        {categories.data?.find((x) => x.slug === c)?.name ?? c}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <span className="text-xl font-extrabold text-slate-900">
                        {taka(t.hourlyRateBdt)}
                      </span>
                      <span className="text-sm text-slate-500"> /hour</span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/technicians/${t.id}?${bookParams}`}
                        className="btn-secondary py-2"
                      >
                        Profile
                      </Link>
                      <Link
                        to={`/technicians/${t.id}?${bookParams}#book`}
                        className="btn-primary py-2"
                      >
                        Book now
                      </Link>
                    </div>
                  </div>
                  <RankWhy t={t} />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
        <div className="order-first lg:order-none">
          <div className="sticky top-44 h-[45vh] overflow-hidden rounded-2xl border border-slate-200 shadow-[var(--shadow-soft)] lg:h-[calc(100vh-12rem)]">
            <ResultsMap
              origin={{ lat, lng }}
              radiusKm={radiusKm}
              technicians={results.data?.items ?? []}
              highlighted={highlight}
              onSelect={setHighlight}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
