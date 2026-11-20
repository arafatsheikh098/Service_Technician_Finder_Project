import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Inbox,
  MapPin,
  MessageSquare,
  Plus,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateTime, formatTime, taka } from '../lib/format';
import type { Booking, BookingStatus, Category, Page, TechnicianProfile } from '../lib/types';
import {
  Avatar,
  ErrorBox,
  PageHeader,
  Section,
  Skeleton,
  Spinner,
  StatCard,
  StatusBadge,
  Verified,
} from '../components/ui';
import { CategoryIcon } from '../components/categories';
import { ColumnChart } from '../components/charts';
import { CountUp } from '../components/motion';

interface Summary {
  role: 'customer' | 'technician';
  byStatus: Partial<Record<BookingStatus, number>>;
  activeCount: number;
  completedCount: number;
  pendingRequests: number;
  paidTotalBdt: number;
  paidThisMonthBdt: number;
  monthly: { month: string; jobs: number; amount: number }[];
  nextBooking: Booking | null;
}

const greeting = () => {
  const h = Number(
    new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hour12: false }),
  );
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** "in 2 days", "in 3 hours", "now". */
function relative(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 3600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3600_000), 'hour');
  return rtf.format(Math.round(diff / 86_400_000), 'day');
}

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short' });

function NextBooking({ b, isTech }: { b: Booking; isTech: boolean }) {
  const other = isTech ? { fullName: b.customer.fullName, avatarUrl: null } : b.technician;
  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl bg-ink-950 p-6 text-white shadow-[var(--shadow-lift)] sm:p-8">
      <div className="bg-grid absolute inset-0 opacity-60" />
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="relative flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-300">
            {isTech ? 'Next job' : 'Next booking'}
          </span>
          <StatusBadge status={b.status} />
        </div>
        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar name={other.fullName} url={other.avatarUrl} size="lg" />
            <div className="min-w-0">
              <div className="text-2xl font-extrabold">{b.category.name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-slate-300">
                {isTech ? 'for' : 'with'} {other.fullName}{' '}
                {!isTech && <Verified className="h-4 w-4" />}
              </div>
              <div className="mt-1 flex items-center gap-1 truncate text-sm text-slate-400">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {b.address}
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/15 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {relative(b.startAt)}
            </div>
            <div className="mt-1 text-lg font-extrabold">{formatDateTime(b.startAt)}</div>
            <div className="text-sm text-slate-300">
              until {formatTime(b.endAt)} · {taka(b.quotedPriceBdt)}
            </div>
          </div>
        </div>
        {b.problemDescription && (
          <p className="mt-6 rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300 ring-1 ring-white/10">
            <span className="mr-1 font-semibold text-slate-400">Job:</span> {b.problemDescription}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-6">
          <Link to={`/bookings/${b.id}`} className="btn-accent">
            Open {isTech ? 'job' : 'booking'} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to={`/bookings/${b.id}#chat`}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            <MessageSquare className="h-4 w-4" /> Message
          </Link>
        </div>
      </div>
    </div>
  );
}

function BookingRow({ b, isTech }: { b: Booking; isTech: boolean }) {
  const other = isTech ? b.customer.fullName : b.technician.fullName;
  return (
    <Link
      to={`/bookings/${b.id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
    >
      <CategoryIcon slug={b.category.slug} size="md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">
          {b.category.name} · {other}
        </div>
        <div className="text-xs text-slate-500">{formatDateTime(b.startAt)}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold">{taka(b.quotedPriceBdt)}</div>
        <StatusBadge status={b.status} />
      </div>
    </Link>
  );
}

function CustomerDashboard({ s }: { s: Summary }) {
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: Category[] }>('/categories').then((r) => r.items),
    staleTime: 300_000,
  });
  const recent = useQuery({
    queryKey: ['bookings', 'recent-past'],
    queryFn: () => api<Page<Booking>>('/bookings?scope=past&pageSize=4'),
  });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active bookings"
          value={<CountUp value={s.activeCount} />}
          icon={CalendarClock}
          tint="bg-sky-100 text-sky-700"
          sub="Pending, confirmed or in progress"
        />
        <StatCard
          label="Jobs completed"
          value={<CountUp value={s.completedCount} />}
          icon={CheckCircle2}
          tint="bg-brand-100 text-brand-700"
        />
        <StatCard
          label="Total paid"
          value={<CountUp value={s.paidTotalBdt} format={taka} />}
          icon={Wallet}
          tint="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Paid this month"
          value={<CountUp value={s.paidThisMonthBdt} format={taka} />}
          icon={TrendingUp}
          tint="bg-violet-100 text-violet-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        {s.nextBooking ? (
          <NextBooking b={s.nextBooking} isTech={false} />
        ) : (
          <div className="card flex flex-col items-start justify-center p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <CalendarCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-xl font-extrabold">No upcoming bookings</h2>
            <p className="mt-1 text-slate-500">
              Need something fixed? Verified pros near you are a few taps away.
            </p>
            <Link to="/search" className="btn-primary mt-5">
              <Plus className="h-4 w-4" /> Book a service
            </Link>
          </div>
        )}
        <Section icon={Plus} title="Quick book" description="Jump straight to pros near you">
          <div className="grid grid-cols-3 gap-2">
            {categories.data?.slice(0, 9).map((c) => (
              <Link
                key={c.slug}
                to={`/search?category=${c.slug}`}
                className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition hover:bg-slate-50"
              >
                <CategoryIcon slug={c.slug} />
                <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-slate-600">
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Section
          icon={TrendingUp}
          title="Spending"
          description="Completed jobs over the last 6 months"
        >
          <ColumnChart
            label="Spending per month"
            data={s.monthly.map((m) => ({
              label: monthLabel(m.month),
              value: m.amount,
              detail: `${m.jobs} job${m.jobs === 1 ? '' : 's'}`,
            }))}
            format={taka}
          />
        </Section>
        <Section
          icon={Clock}
          title="Recent"
          action={
            <Link to="/bookings" className="text-sm font-semibold text-brand-700">
              View all
            </Link>
          }
          bodyClassName="p-3"
        >
          {recent.isLoading && <Skeleton className="h-40" />}
          {recent.data?.items.length === 0 && (
            <p className="p-3 text-sm text-slate-500">Past bookings will show up here.</p>
          )}
          {recent.data?.items.map((b) => (
            <BookingRow key={b.id} b={b} isTech={false} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function TechnicianDashboard({ s }: { s: Summary }) {
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ['my-tech-profile'],
    queryFn: () => api<TechnicianProfile>('/technicians/me/profile'),
  });
  const pending = useQuery({
    queryKey: ['bookings', 'pending'],
    queryFn: () => api<Page<Booking>>('/bookings?status=pending&pageSize=10'),
  });
  const toggle = useMutation({
    mutationFn: (isAvailable: boolean) =>
      api<TechnicianProfile>('/technicians/me/profile', { method: 'PATCH', body: { isAvailable } }),
    onSuccess: (p) => qc.setQueryData(['my-tech-profile'], p),
  });
  const respond = useMutation({
    mutationFn: ({ id, to }: { id: string; to: 'accepted' | 'rejected' }) =>
      api(`/bookings/${id}/transitions`, { method: 'POST', body: { to } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });
  const p = profile.data;

  return (
    <div className="space-y-6">
      {p && !p.isVerified && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <b>Verification pending.</b> An admin is reviewing your profile. You'll appear in search
            as soon as it's approved.
          </div>
        </div>
      )}

      {p && (
        <div
          className={clsx(
            'flex flex-wrap items-center gap-4 rounded-3xl p-5 ring-1 transition',
            p.isAvailable
              ? 'bg-gradient-to-r from-brand-50 to-white ring-brand-200'
              : 'bg-slate-100 ring-slate-200',
          )}
        >
          <span
            className={clsx(
              'relative flex h-12 w-12 items-center justify-center rounded-2xl',
              p.isAvailable ? 'bg-brand-500 text-white' : 'bg-slate-300 text-slate-600',
            )}
          >
            {p.isAvailable && (
              <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-400 opacity-30" />
            )}
            <BadgeCheck className="relative h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold">
              {p.isAvailable ? "You're online and taking jobs" : "You're offline"}
            </div>
            <div className="text-sm text-slate-500">
              {p.isAvailable
                ? 'Customers near you can see and book you right now.'
                : 'You are hidden from search until you go online.'}
            </div>
          </div>
          <button
            role="switch"
            aria-checked={p.isAvailable}
            onClick={() => toggle.mutate(!p.isAvailable)}
            className={clsx(
              'relative h-9 w-16 rounded-full transition',
              p.isAvailable ? 'bg-brand-600' : 'bg-slate-400',
            )}
          >
            <span
              className={clsx(
                'absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all',
                p.isAvailable ? 'left-8' : 'left-1',
              )}
            />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="New requests"
          value={<CountUp value={s.pendingRequests} />}
          icon={Inbox}
          tint="bg-amber-100 text-amber-700"
          sub="Waiting for your answer"
        />
        <StatCard
          label="Upcoming jobs"
          value={<CountUp value={s.activeCount - s.pendingRequests} />}
          icon={CalendarClock}
          tint="bg-sky-100 text-sky-700"
        />
        <StatCard
          label="Earned this month"
          value={<CountUp value={s.paidThisMonthBdt} format={taka} />}
          icon={Wallet}
          tint="bg-brand-100 text-brand-700"
          sub={`${taka(s.paidTotalBdt)} all time`}
        />
        <StatCard
          label="Rating"
          value={p?.ratingAvg ? <CountUp value={p.ratingAvg} format={(n) => n.toFixed(1)} /> : '—'}
          icon={Star}
          tint="bg-violet-100 text-violet-700"
          sub={p ? `${p.ratingCount} reviews · ${s.completedCount} jobs` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Section
          icon={Inbox}
          title="New job requests"
          description="Accept quickly: your acceptance rate improves your ranking"
          action={
            pending.data && pending.data.total > 0 ? (
              <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-extrabold text-ink-900">
                {pending.data.total}
              </span>
            ) : undefined
          }
          bodyClassName="p-3"
        >
          {pending.isLoading && <Skeleton className="h-32" />}
          {pending.data?.items.length === 0 && (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <Inbox className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-600">No new requests</p>
              <p className="text-sm text-slate-500">New requests appear here instantly.</p>
            </div>
          )}
          <div className="space-y-2">
            {pending.data?.items.map((b) => (
              <div key={b.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-start gap-3">
                  <CategoryIcon slug={b.category.slug} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/bookings/${b.id}`} className="font-bold hover:text-brand-700">
                      {b.category.name} · {b.customer.fullName}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatDateTime(b.startAt)} (
                        {relative(b.startAt)})
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {b.address}
                      </span>
                    </div>
                    {b.problemDescription && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                        “{b.problemDescription}”
                      </p>
                    )}
                  </div>
                  <div className="text-right text-lg font-extrabold">{taka(b.quotedPriceBdt)}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-primary flex-1 py-2"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: b.id, to: 'accepted' })}
                  >
                    {respond.isPending &&
                    respond.variables?.id === b.id &&
                    respond.variables.to === 'accepted' ? (
                      <Spinner className="h-4 w-4 text-white" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}{' '}
                    Accept
                  </button>
                  <button
                    className="btn-secondary flex-1 py-2"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: b.id, to: 'rejected' })}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-1">
            <ErrorBox error={respond.error} />
          </div>
        </Section>
        <div className="space-y-6">
          {s.nextBooking && s.nextBooking.status !== 'pending' ? (
            <NextBooking b={s.nextBooking} isTech />
          ) : null}
          <Section icon={TrendingUp} title="Earnings" description="Completed jobs, last 6 months">
            <ColumnChart
              label="Earnings per month"
              data={s.monthly.map((m) => ({
                label: monthLabel(m.month),
                value: m.amount,
                detail: `${m.jobs} job${m.jobs === 1 ? '' : 's'}`,
              }))}
              format={taka}
              height={140}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => api<Summary>('/bookings/summary'),
  });
  const isTech = user?.role === 'technician';
  const today = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Asia/Dhaka',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div>
      <PageHeader
        eyebrow={today}
        title={`${greeting()}, ${user?.fullName.split(' ')[0]}`}
        subtitle={
          isTech
            ? "Here's what's happening with your jobs today."
            : "Here's an overview of your bookings."
        }
      >
        {isTech ? (
          <Link to="/bookings" className="btn-secondary">
            <CalendarCheck className="h-4 w-4" /> All jobs
          </Link>
        ) : (
          <Link to="/search" className="btn-primary">
            <Plus className="h-4 w-4" /> Book a service
          </Link>
        )}
      </PageHeader>
      <ErrorBox error={summary.error} />
      {summary.isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      )}
      {summary.data &&
        (isTech ? (
          <TechnicianDashboard s={summary.data} />
        ) : (
          <CustomerDashboard s={summary.data} />
        ))}
    </div>
  );
}
