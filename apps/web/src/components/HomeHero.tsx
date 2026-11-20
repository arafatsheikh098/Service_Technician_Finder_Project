import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  MapPin,
  Navigation,
  Search as SearchIcon,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { taka } from '../lib/format';
import { PRESET_LOCATIONS, currentPosition, loadSavedLocation, saveLocation } from '../lib/geo';
import type { Category, TriageResult } from '../lib/types';
import { ErrorBox, Spinner, Verified } from './ui';
import { CategoryIcon } from './categories';

const URGENCY_STYLE = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-sky-100 text-sky-800',
  high: 'bg-amber-100 text-amber-800',
  emergency: 'bg-rose-100 text-rose-800',
};

/** Illustration: a stylised map with a technician driving to your door. Pure SVG/CSS. */
export function LivePreview() {
  const route = 'M 60 300 C 120 250, 110 190, 180 170 S 280 150, 300 95';
  return (
    <div className="relative mx-auto w-full max-w-md animate-fade-up [animation-delay:150ms]">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-500/30 via-transparent to-amber-400/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-ink-800/80 p-3 shadow-2xl backdrop-blur">
        <div className="relative overflow-hidden rounded-2xl bg-[#0f1b30]">
          <svg viewBox="0 0 360 360" className="block w-full">
            <defs>
              <pattern id="blocks" width="40" height="40" patternUnits="userSpaceOnUse">
                <rect width="40" height="40" fill="#0f1b30" />
                <rect x="4" y="4" width="32" height="32" rx="4" fill="#15243d" />
              </pattern>
              <linearGradient id="route" x1="0" x2="1">
                <stop offset="0%" stopColor="#34c3a6" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
            <rect width="360" height="360" fill="url(#blocks)" />
            <path d="M0 210 Q 180 160 360 230" stroke="#1d3150" strokeWidth="18" fill="none" />
            <path d="M120 0 Q 150 180 90 360" stroke="#1d3150" strokeWidth="14" fill="none" />
            <path d="M250 0 L 270 360" stroke="#1d3150" strokeWidth="12" fill="none" />
            <path d="M0 330 Q 200 300 360 250 L 360 360 L 0 360 Z" fill="#12385a" opacity="0.7" />
            <path
              d={route}
              stroke="url(#route)"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="2 10"
            />
            <circle cx="300" cy="95" r="22" fill="#fbbf24" opacity="0.15">
              <animate attributeName="r" values="14;26;14" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx="300" cy="95" r="9" fill="#fbbf24" stroke="#fff" strokeWidth="3" />
            <g>
              <circle r="16" fill="#14a88d" opacity="0.25">
                <animate attributeName="r" values="10;20;10" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <circle r="8" fill="#34c3a6" stroke="#fff" strokeWidth="3" />
              <animateMotion
                dur="9s"
                repeatCount="indefinite"
                path={route}
                keyPoints="0;1;1"
                keyTimes="0;0.85;1"
                calcMode="linear"
              />
            </g>
          </svg>
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-lg">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
            </span>
            Live tracking
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white">
            <Navigation className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-sm font-bold text-slate-900">
              Your electrician is on the way <Verified className="h-4 w-4" />
            </div>
            <div className="text-xs text-slate-500">
              Follow every turn until they reach your door
            </div>
          </div>
          <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-extrabold text-amber-800">
            ETA 6m
          </span>
        </div>
      </div>
      <div className="absolute -left-6 top-24 hidden animate-float items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-[var(--shadow-lift)] sm:flex">
        <ShieldCheck className="h-4 w-4 text-brand-600" /> ID-verified pro
      </div>
      <div className="absolute -right-4 bottom-28 hidden animate-float items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-[var(--shadow-lift)] [animation-delay:1.5s] sm:flex">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Rated by real customers
      </div>
    </div>
  );
}

export function HeroSearch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<'search' | 'describe'>('search');
  const [location, setLocation] = useState(() => loadSavedLocation() ?? PRESET_LOCATIONS[0]!);
  const [category, setCategory] = useState('');
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState('');

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: Category[] }>('/categories').then((r) => r.items),
    staleTime: 5 * 60_000,
  });
  const triage = useMutation({
    mutationFn: (description: string) =>
      api<TriageResult>('/triage', { method: 'POST', body: { description } }),
  });

  const go = (cat?: string) => {
    const q = new URLSearchParams({ lat: String(location.lat), lng: String(location.lng) });
    if (cat) q.set('category', cat);
    navigate(`/search?${q}`);
  };
  const useMyLocation = async () => {
    setLocating(true);
    try {
      const p = await currentPosition();
      const loc = { ...p, label: 'My current location' };
      setLocation(loc);
      saveLocation(loc);
    } catch {
      alert('Could not get your location. Pick an area from the list instead.');
    } finally {
      setLocating(false);
    }
  };
  const isPreset = PRESET_LOCATIONS.some((p) => p.label === location.label);

  return (
    <div className="mt-8 rounded-3xl bg-white p-2 text-slate-800 shadow-2xl ring-1 ring-black/5">
      <div className="flex gap-1 p-1">
        {(
          [
            ['search', 'Search', SearchIcon],
            ['describe', 'Describe your problem', Sparkles],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold transition',
              tab === key ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-100',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
            {key === 'describe' && (
              <span className="rounded-md bg-amber-300 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-900">
                AI
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-1.5">
          <MapPin className="h-5 w-5 shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Location
            </div>
            <select
              className="w-full truncate bg-transparent text-sm font-semibold text-slate-800 outline-none"
              value={isPreset ? location.label : ''}
              onChange={(e) => {
                const loc = PRESET_LOCATIONS.find((p) => p.label === e.target.value);
                if (loc) {
                  setLocation(loc);
                  saveLocation(loc);
                }
              }}
            >
              {!isPreset && <option value="">{location.label}</option>}
              {PRESET_LOCATIONS.map((p) => (
                <option key={p.label}>{p.label}</option>
              ))}
            </select>
          </div>
          <button
            className="btn-ghost shrink-0 px-2.5"
            onClick={useMyLocation}
            disabled={locating}
            title="Use my current location"
          >
            {locating ? (
              <Spinner className="h-4 w-4 text-brand-600" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </button>
        </div>

        {tab === 'search' ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 px-3 py-1.5">
              <SearchIcon className="h-5 w-5 shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Service
                </div>
                <select
                  className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All services</option>
                  {categories.data?.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              className="btn-primary px-6 py-3.5 text-base"
              onClick={() => go(category || undefined)}
            >
              Search <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <textarea
              className="input min-h-24 resize-none rounded-2xl text-[15px] shadow-none"
              placeholder="e.g. AC theke pani porche · বাথরুমের কল দিয়ে পানি পড়ছে · ceiling fan makes a noise"
              value={problem}
              maxLength={1000}
              onChange={(e) => setProblem(e.target.value)}
            />
            {user ? (
              <button
                className="btn-primary mt-2 w-full py-3"
                disabled={problem.trim().length < 5 || triage.isPending}
                onClick={() => triage.mutate(problem)}
              >
                {triage.isPending ? (
                  <Spinner className="h-4 w-4 text-white" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}{' '}
                Find the right service
              </button>
            ) : (
              <Link to="/login?next=/" className="btn-primary mt-2 w-full py-3">
                Log in to use smart matching
              </Link>
            )}
            <div className="mt-2">
              <ErrorBox error={triage.error} />
            </div>
            {triage.data && (
              <div className="mt-3 animate-fade-up rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4">
                {triage.data.safetyAdvice && (
                  <div className="mb-3 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
                    <TriangleAlert className="h-4 w-4 shrink-0" /> {triage.data.safetyAdvice}
                  </div>
                )}
                {triage.data.category ? (
                  <>
                    <div className="flex items-center gap-3">
                      <CategoryIcon slug={triage.data.category.slug} />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900">{triage.data.category.name}</div>
                        {triage.data.priceRangeBdt && (
                          <div className="text-sm text-slate-600">
                            Typical cost{' '}
                            <b className="text-slate-900">
                              {taka(triage.data.priceRangeBdt.min)}–
                              {taka(triage.data.priceRangeBdt.max)}
                            </b>{' '}
                            · ~{triage.data.estimatedHours}h
                          </div>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${URGENCY_STYLE[triage.data.urgency]}`}
                      >
                        {triage.data.urgency}
                      </span>
                    </div>
                    <button
                      className="btn-primary mt-3 w-full"
                      onClick={() => go(triage.data!.category!.slug)}
                    >
                      Show {triage.data.category.name} pros near me{' '}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
                      {triage.data.source === 'ai' ? 'Suggested by AI' : 'Matched by keywords'} ·{' '}
                      {Math.round(triage.data.confidence * 100)}% confidence
                    </p>
                  </>
                ) : (
                  <p className="text-sm">
                    We couldn't tell which service you need. Try the Search tab.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
