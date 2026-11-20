import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CalendarX, ChevronRight, Clock, MapPin, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatTime, taka } from '../lib/format';
import type { Booking, Page } from '../lib/types';
import { Avatar, Empty, ErrorBox, PageHeader, Skeleton, StatusBadge } from '../components/ui';
import { CategoryIcon } from '../components/categories';

const dhaka = { timeZone: 'Asia/Dhaka' } as const;

function DateTile({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div className="flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-center">
      <div className="w-full bg-gradient-to-br from-brand-500 to-brand-700 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white">
        {d.toLocaleDateString('en-GB', { ...dhaka, month: 'short' })}
      </div>
      <div className="pt-1 text-2xl font-extrabold leading-none text-slate-900">
        {d.toLocaleDateString('en-GB', { ...dhaka, day: 'numeric' })}
      </div>
      <div className="pb-1.5 text-[10px] font-semibold uppercase text-slate-400">
        {d.toLocaleDateString('en-GB', { ...dhaka, weekday: 'short' })}
      </div>
    </div>
  );
}

export default function Bookings() {
  const { user } = useAuth();
  const [scope, setScope] = useState<'active' | 'past'>('active');
  const isTech = user?.role === 'technician';

  const bookings = useQuery({
    queryKey: ['bookings', scope],
    queryFn: () => api<Page<Booking>>(`/bookings?scope=${scope}&pageSize=50`),
  });

  return (
    <div>
      <PageHeader
        eyebrow={isTech ? 'Technician' : 'Customer'}
        title={isTech ? 'My jobs' : 'My bookings'}
        subtitle={
          isTech
            ? 'Requests and jobs assigned to you. New requests appear here instantly.'
            : 'Everything you have booked, in one place.'
        }
      >
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-bold">
            {(['active', 'past'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={clsx(
                  'rounded-lg px-4 py-2 transition',
                  scope === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                )}
              >
                {s === 'active' ? 'Upcoming' : 'Past'}
              </button>
            ))}
          </div>
          {!isTech && (
            <Link to="/search" className="btn-primary">
              <Plus className="h-4 w-4" /> New booking
            </Link>
          )}
        </div>
      </PageHeader>

      <div className="space-y-3">
        {bookings.isLoading &&
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        <ErrorBox error={bookings.error} />
        {bookings.data?.items.length === 0 && (
          <Empty
            icon={<CalendarX className="h-8 w-8" />}
            title={scope === 'active' ? 'Nothing upcoming' : 'No past bookings'}
          >
            {isTech ? (
              'New job requests will appear here the moment a customer books you.'
            ) : (
              <Link className="font-semibold text-brand-700" to="/search">
                Find a technician →
              </Link>
            )}
          </Empty>
        )}
        {bookings.data?.items.map((b, i) => {
          const other = isTech ? { fullName: b.customer.fullName, avatarUrl: null } : b.technician;
          const paymentDue = b.status === 'completed' && b.paymentStatus !== 'succeeded' && !isTech;
          return (
            <Link
              key={b.id}
              to={`/bookings/${b.id}`}
              className="card card-hover group flex animate-fade-up items-center gap-4 p-4 sm:p-5"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <DateTile iso={b.startAt} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryIcon slug={b.category.slug} size="sm" />
                  <span className="font-bold text-slate-900">{b.category.name}</span>
                  <StatusBadge status={b.status} />
                  {paymentDue && (
                    <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-ink-900">
                      Payment due
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Avatar name={other.fullName} url={other.avatarUrl} size="sm" />
                    <span className="font-medium text-slate-700">{other.fullName}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {formatTime(b.startAt)} –{' '}
                    {formatTime(b.endAt)}
                  </span>
                  <span className="flex min-w-0 items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />{' '}
                    <span className="truncate">{b.address}</span>
                  </span>
                </div>
              </div>
              <div className="hidden text-right sm:block">
                <div className="text-lg font-extrabold text-slate-900">
                  {taka(b.quotedPriceBdt)}
                </div>
                {b.paymentStatus === 'succeeded' && (
                  <div className="text-xs font-bold text-emerald-600">Paid</div>
                )}
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
