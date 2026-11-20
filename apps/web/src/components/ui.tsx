import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertCircle, BadgeCheck, Loader2, Star } from 'lucide-react';
import { initials, STATUS_COLOR, STATUS_LABEL } from '../lib/format';
import type { BookingStatus } from '../lib/types';
import { ApiError } from '../lib/api';

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={clsx('animate-spin', className ?? 'h-5 w-5 text-brand-600')}
      aria-label="Loading"
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-24">
      <Spinner className="h-8 w-8 text-brand-600" />
    </div>
  );
}

// Deterministic gradient per name, so the same person always gets the same colours.
const GRADIENTS = [
  'from-brand-400 to-brand-700',
  'from-sky-400 to-indigo-600',
  'from-amber-400 to-orange-600',
  'from-fuchsia-400 to-purple-600',
  'from-emerald-400 to-teal-700',
  'from-rose-400 to-pink-600',
  'from-cyan-400 to-blue-600',
];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({
  name,
  url,
  size = 'md',
  ring,
}: {
  name: string;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
}) {
  const cls = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-16 w-16 text-lg',
    xl: 'h-24 w-24 text-2xl',
  }[size];
  const ringCls = ring ? 'ring-4 ring-white shadow-[var(--shadow-lift)]' : '';
  return url ? (
    <img src={url} alt="" className={clsx(cls, ringCls, 'shrink-0 rounded-full object-cover')} />
  ) : (
    <div
      className={clsx(
        cls,
        ringCls,
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white',
        GRADIENTS[hash(name) % GRADIENTS.length],
      )}
    >
      {initials(name)}
    </div>
  );
}

export function Verified({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={clsx('shrink-0 fill-brand-500 text-white', className ?? 'h-5 w-5')}
      aria-label="Verified"
    />
  );
}

export function Stars({
  value,
  count,
  dark,
}: {
  value: number | null;
  count?: number;
  dark?: boolean;
}) {
  if (value === null)
    return <span className={clsx('chip', dark && 'bg-white/10 text-white')}>New</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
      <span className="font-bold">{value.toFixed(1)}</span>
      {count !== undefined && (
        <span className={dark ? 'text-white/60' : 'text-slate-500'}>({count})</span>
      )}
    </span>
  );
}

/** Circular 0–100 gauge used for the match score. */
export function ScoreRing({ value, size = 52 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(value * 100);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={`Match score ${pct}/100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#score-grad)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
        />
        <defs>
          <linearGradient id="score-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#34c3a6" />
            <stop offset="100%" stopColor="#0c6e60" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-sm font-extrabold text-slate-900">{pct}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
          match
        </span>
      </div>
    </div>
  );
}

export function StatusBadge({
  status,
  size = 'sm',
}: {
  status: BookingStatus;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        STATUS_COLOR[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

export function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-600">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** A card with an icon header, used to group settings and details. */
export function Section({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  icon?: typeof Star;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx('card overflow-hidden', className)}>
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className={clsx('p-6', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small KPI tile with an icon. */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tint = 'bg-brand-50 text-brand-600',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: typeof Star;
  tint?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-slate-500">{label}</div>
        <span className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', tint)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">
        {value}
      </div>
      {sub && <div className="mt-1 text-xs font-medium text-slate-500">{sub}</div>}
    </div>
  );
}
