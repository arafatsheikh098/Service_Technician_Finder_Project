import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Briefcase, Clock, MapPin, ShieldCheck, Star, ThumbsUp, Wallet } from 'lucide-react';
import { api, ApiError, newIdempotencyKey } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, taka } from '../lib/format';
import { PRESET_LOCATIONS, loadSavedLocation, type LatLng } from '../lib/geo';
import type { BookingDetail, TechnicianProfile } from '../lib/types';
import { Avatar, ErrorBox, Field, PageLoader, Spinner, Stars, Verified } from '../components/ui';
import { CategoryIcon } from '../components/categories';
import { Aurora } from '../components/motion';
import { LocationPicker } from '../components/maps';

const tomorrow = () => {
  const d = new Date(Date.now() + 86_400_000);
  return d.toISOString().slice(0, 10);
};

export default function TechnicianPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const profile = useQuery({
    queryKey: ['technician', id],
    queryFn: () => api<TechnicianProfile>(`/technicians/${id}`),
  });

  const [category, setCategory] = useState(params.get('category') ?? '');
  const [date, setDate] = useState(params.get('date') ?? tomorrow());
  const [time, setTime] = useState(params.get('time') ?? '10:00');
  const [hours, setHours] = useState(2);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  // Default the job pin to the customer's chosen area, never the technician's own base.
  const [loc, setLoc] = useState<LatLng>(() => loadSavedLocation() ?? PRESET_LOCATIONS[0]!);
  // One key per booking attempt: a double-click or a retry after a network drop
  // reuses it, so they can never create two bookings. Once the server has answered
  // with an error, the next attempt is a new request and gets a new key.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const book = useMutation({
    mutationFn: () =>
      api<BookingDetail>('/bookings', {
        method: 'POST',
        idempotencyKey,
        body: {
          technicianId: id,
          category: category || p?.categories[0]?.slug,
          startAt: new Date(`${date}T${time}:00+06:00`).toISOString(),
          durationHours: hours,
          address,
          lat: loc.lat,
          lng: loc.lng,
          problemDescription: description || undefined,
        },
      }),
    onSuccess: (b) => navigate(`/bookings/${b.id}`),
    onError: (err) => {
      if (err instanceof ApiError) setIdempotencyKey(newIdempotencyKey());
    },
  });

  if (profile.isLoading) return <PageLoader />;
  if (profile.error)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorBox error={profile.error} />
      </div>
    );
  const p = profile.data!;
  const slotTaken = book.error instanceof ApiError && book.error.code === 'SLOT_TAKEN';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    book.mutate();
  };

  const stats: [string, string][] = [
    ['Rating', p.ratingAvg !== null ? `${p.ratingAvg.toFixed(1)} ★` : 'New'],
    ['Jobs done', String(p.jobsCompleted)],
    ['Experience', `${p.experienceYears} yrs`],
    ['Accepts', p.acceptanceRate !== null ? `${Math.round(p.acceptanceRate * 100)}%` : '—'],
  ];

  return (
    <div>
      <div className="relative h-44 overflow-hidden bg-ink-950 sm:h-52">
        <div className="bg-grid absolute inset-0 opacity-70" />
        <Aurora />
      </div>
      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-6 px-4 pb-16 lg:grid-cols-[1.4fr_1fr]">
        <div className="-mt-20 space-y-6">
          <div className="card relative p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <div className="-mt-20 sm:-mt-24">
                <Avatar name={p.fullName} url={p.avatarUrl} size="xl" ring />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="flex items-center gap-2 text-3xl font-extrabold">
                  {p.fullName} {p.isVerified && <Verified className="h-6 w-6" />}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {p.areaLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" /> Serves within {p.serviceRadiusKm} km
                  </span>
                  <span>Member since {formatDate(p.memberSince)}</span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-3xl font-extrabold">{taka(p.hourlyRateBdt)}</div>
                <div className="text-sm text-slate-500">per hour</div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {p.categories.map((c) => (
                <span
                  key={c.id}
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-3 text-sm font-semibold text-slate-700"
                >
                  <CategoryIcon slug={c.slug} size="sm" /> {c.name}
                </span>
              ))}
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 text-xl font-extrabold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
            {p.bio && (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">About</h2>
                <p className="mt-2 leading-relaxed text-slate-700">{p.bio}</p>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-4 border-t border-slate-100 pt-5 text-sm font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-600" /> Identity verified
              </span>
              <span className="flex items-center gap-1.5">
                <ThumbsUp className="h-4 w-4 text-brand-600" /> Reviews from real bookings only
              </span>
              <span className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-brand-600" /> Pay after the job
              </span>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Reviews</h2>
              <Stars value={p.ratingAvg} count={p.ratingCount} />
            </div>
            {p.recentReviews.length === 0 && (
              <p className="mt-3 text-sm text-slate-500">No reviews yet.</p>
            )}
            <ul className="mt-4 space-y-4">
              {p.recentReviews.map((r, i) => (
                <li key={i} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.customerName} size="sm" />
                    <div className="flex-1">
                      <div className="text-sm font-bold">{r.customerName}</div>
                      <div className="text-xs text-slate-500">{formatDate(r.createdAt)}</div>
                    </div>
                    <div className="flex" aria-label={`${r.rating} stars`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={clsx(
                            'h-4 w-4',
                            n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-700">{r.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:-mt-20" id="book">
          <form onSubmit={submit} className="card sticky top-20 space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Book {p.fullName.split(' ')[0]}</h2>
              <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />{' '}
                {p.isAvailable ? 'Taking jobs' : 'Paused'}
              </span>
            </div>
            {!user ? (
              <Link
                to={`/login?next=${encodeURIComponent(`/technicians/${id}`)}`}
                className="btn-primary w-full py-3"
              >
                Log in to book
              </Link>
            ) : user.role !== 'customer' ? (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                Log in with a customer account to book.
              </p>
            ) : (
              <>
                <Field label="Service">
                  <select
                    className="input"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Choose a service…</option>
                    {p.categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-[1.3fr_1fr] gap-2">
                  <Field label="Date">
                    <input
                      className="input"
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Start time">
                    <input
                      className="input"
                      type="time"
                      required
                      step={1800}
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </Field>
                </div>
                <div>
                  <span className="label">Duration</span>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 6, 8].map((h) => (
                      <button
                        type="button"
                        key={h}
                        onClick={() => setHours(h)}
                        className={clsx(
                          'rounded-xl border py-2 text-sm font-bold transition',
                          hours === h
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                        )}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Address">
                  <input
                    className="input"
                    required
                    minLength={3}
                    placeholder="House, road, area"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </Field>
                <div>
                  <span className="label">Pin the exact spot</span>
                  <LocationPicker value={loc} onChange={setLoc} height={170} />
                </div>
                <Field label="What's the problem? (optional)">
                  <textarea
                    className="input min-h-20"
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                <div className="space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>
                      {taka(p.hourlyRateBdt)} × {hours} hour{hours > 1 ? 's' : ''}
                    </span>
                    <span>{taka(p.hourlyRateBdt * hours)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Booking fee</span>
                    <span className="font-semibold text-brand-700">Free</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold text-slate-900">
                    <span>Estimated total</span>
                    <span>{taka(p.hourlyRateBdt * hours)}</span>
                  </div>
                </div>
                {slotTaken ? (
                  <ErrorBox
                    error={
                      new Error(
                        'That time was just booked by someone else. Please choose another time.',
                      )
                    }
                  />
                ) : (
                  <ErrorBox error={book.error} />
                )}
                <button className="btn-primary w-full py-3.5 text-base" disabled={book.isPending}>
                  {book.isPending && <Spinner className="h-4 w-4 text-white" />} Request booking
                </button>
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" /> Free cancellation until the technician sets off
                </p>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
