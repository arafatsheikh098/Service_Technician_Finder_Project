import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BadgeCheck,
  Ban,
  CalendarCheck,
  CheckCircle2,
  Search as SearchIcon,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, STATUS_LABEL, taka } from '../lib/format';
import type { BookingStatus, Page } from '../lib/types';
import { Avatar, ErrorBox, PageHeader, PageLoader, Spinner, StatusBadge } from '../components/ui';

interface Stats {
  usersByRole: Record<string, number>;
  bookingsByStatus: Partial<Record<BookingStatus, number>>;
  revenueBdt: number;
  pendingVerifications: number;
  bookingsLast14Days: { day: string; bookings: number }[];
}
interface AdminTech {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isVerified: boolean;
  areaLabel: string | null;
  experienceYears: number;
  hourlyRateBdt: number;
  jobsCompleted: number;
  ratingAvg: number | null;
  categories: string[];
  createdAt: string;
}

function Tile({
  label,
  value,
  sub,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Users;
  tint: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-500">{label}</div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <div className="mt-2 text-3xl font-extrabold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs font-medium text-slate-500">{sub}</div>}
    </div>
  );
}

/** Single-series column chart: one hue, rounded data-ends on the baseline, hover tooltip per bar. */
function DailyBookings({ data }: { data: Stats['bookingsLast14Days'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.bookings));
  const label = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return (
    <div className="card h-full p-6">
      <h2 className="font-bold">New bookings per day</h2>
      <p className="text-xs text-slate-500">Last 14 days</p>
      <div
        className="relative mt-4 flex h-40 items-end gap-0.5 border-b border-slate-200"
        role="img"
        aria-label="Bookings per day for the last 14 days"
      >
        {data.map((d, i) => (
          <div
            key={d.day}
            className="flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className={clsx(
                'w-full rounded-t-[4px] transition-colors',
                hover === i ? 'bg-brand-800' : 'bg-brand-600',
              )}
              style={{ height: `${(d.bookings / max) * 100}%`, minHeight: d.bookings ? 2 : 0 }}
            />
          </div>
        ))}
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white"
            style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
          >
            {label(data[hover]!.day)}: <b>{data[hover]!.bookings}</b>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{data[0] && label(data[0].day)}</span>
        <span>{data.at(-1) && label(data.at(-1)!.day)}</span>
      </div>
      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer">Show as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {data.map((d) => (
              <tr key={d.day}>
                <td>{label(d.day)}</td>
                <td className="text-right tabular-nums">{d.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export default function Admin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'false' | 'true' | ''>('false');
  const [q, setQ] = useState('');
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: () => api<Stats>('/admin/stats') });
  const techs = useQuery({
    queryKey: ['admin-techs', filter, q],
    queryFn: () =>
      api<Page<AdminTech>>(
        `/admin/technicians?${new URLSearchParams({ ...(filter && { verified: filter }), ...(q && { q }), pageSize: '50' })}`,
      ),
    placeholderData: keepPreviousData,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-techs'] });
    void qc.invalidateQueries({ queryKey: ['admin-stats'] });
  };
  const verify = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
      api(`/admin/technicians/${id}/verification`, { method: 'POST', body: { verified } }),
    onSuccess: refresh,
  });
  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api(`/admin/users/${id}/status`, { method: 'POST', body: { active } }),
    onSuccess: refresh,
  });

  if (stats.isLoading) return <PageLoader />;
  const s = stats.data;
  const totalBookings = Object.values(s?.bookingsByStatus ?? {}).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        subtitle="Platform health, activity and technician verification."
      />
      <div>
        <ErrorBox error={stats.error} />
        {s && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Tile
                label="Customers"
                value={s.usersByRole.customer ?? 0}
                icon={Users}
                tint="bg-sky-100 text-sky-700"
              />
              <Tile
                label="Technicians"
                icon={Wrench}
                tint="bg-amber-100 text-amber-700"
                value={s.usersByRole.technician ?? 0}
                sub={`${s.pendingVerifications} awaiting verification`}
              />
              <Tile
                label="Bookings"
                icon={CalendarCheck}
                tint="bg-violet-100 text-violet-700"
                value={totalBookings}
                sub={`${s.bookingsByStatus.completed ?? 0} completed`}
              />
              <Tile
                label="Revenue processed"
                value={taka(s.revenueBdt)}
                icon={Wallet}
                tint="bg-brand-100 text-brand-700"
              />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <DailyBookings data={s.bookingsLast14Days} />
              </div>
              <div className="card p-6">
                <h2 className="font-bold">Bookings by status</h2>
                <p className="text-sm text-slate-500">All time</p>
                <table className="mt-3 w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((st) => (
                      <tr key={st}>
                        <td className="py-2">
                          <StatusBadge status={st} />
                        </td>
                        <td className="py-2 text-right font-bold tabular-nums">
                          {s.bookingsByStatus[st] ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="card mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="mr-auto">
              <h2 className="font-bold">Technicians</h2>
              <p className="text-sm text-slate-500">
                Only verified technicians appear in customer search.
              </p>
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-bold">
              {(
                [
                  ['false', 'Awaiting'],
                  ['true', 'Verified'],
                  ['', 'All'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={label}
                  onClick={() => setFilter(v)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 transition',
                    filter === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                  )}
                >
                  {label}
                  {v === 'false' && s?.pendingVerifications ? (
                    <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] text-ink-900">
                      {s.pendingVerifications}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input w-60 pl-9"
                placeholder="Search name or email"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {techs.isFetching && <Spinner className="h-4 w-4 text-brand-600" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Technician</th>
                  <th className="px-6 py-3">Services</th>
                  <th className="px-6 py-3">Area</th>
                  <th className="px-6 py-3 text-right">Rate</th>
                  <th className="px-6 py-3 text-right">Jobs</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {techs.data?.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      <CheckCircle2 className="mx-auto mb-2 h-6 w-6" />
                      Nothing here
                    </td>
                  </tr>
                )}
                {techs.data?.items.map((t) => (
                  <tr key={t.id} className={clsx(!t.isActive && 'opacity-50')}>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={t.fullName} size="sm" />
                        <div className="min-w-0">
                          <Link
                            to={`/technicians/${t.id}`}
                            className="flex items-center gap-1 font-bold hover:text-brand-700"
                          >
                            {t.fullName}{' '}
                            {t.isVerified && (
                              <BadgeCheck className="h-4 w-4 fill-brand-500 text-white" />
                            )}
                          </Link>
                          <div className="text-xs text-slate-500">
                            {t.email} · {t.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {t.categories.map((c) => (
                          <span key={c} className="chip">
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-xs">{t.areaLabel}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{taka(t.hourlyRateBdt)}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{t.jobsCompleted}</td>
                    <td className="px-6 py-3.5 text-xs">{formatDate(t.createdAt)}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex justify-end gap-2">
                        <button
                          className={
                            t.isVerified
                              ? 'btn-secondary px-2 py-1 text-xs'
                              : 'btn-primary px-2 py-1 text-xs'
                          }
                          onClick={() => verify.mutate({ id: t.id, verified: !t.isVerified })}
                        >
                          {t.isVerified ? 'Unverify' : 'Verify'}
                        </button>
                        <button
                          className="btn-danger px-2 py-1 text-xs"
                          title={t.isActive ? 'Disable account' : 'Enable account'}
                          onClick={() => setActive.mutate({ id: t.id, active: !t.isActive })}
                        >
                          <Ban className="h-3.5 w-3.5" /> {t.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
