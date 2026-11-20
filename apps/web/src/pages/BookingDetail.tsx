import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { motion } from 'motion/react';
import {
  BellRing,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Hash,
  History,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Receipt,
  Send,
  Star,
  Wrench,
  XCircle,
} from 'lucide-react';
import { api, newIdempotencyKey } from '../lib/api';
import { useAuth } from '../lib/auth';
import { getSocket, useSocketEvent } from '../lib/socket';
import { ACTION_LABEL, formatDateTime, formatTime, STATUS_LABEL, taka } from '../lib/format';
import type { LatLng } from '../lib/geo';
import type { BookingDetail as Booking, BookingStatus, ChatMessage } from '../lib/types';
import { Avatar, ErrorBox, PageLoader, Section, Spinner, Verified } from '../components/ui';
import { TrackingMap } from '../components/maps';

const TIMELINE_ICON: Record<BookingStatus, typeof Clock> = {
  pending: Send,
  accepted: CalendarCheck,
  en_route: Navigation,
  in_progress: Wrench,
  completed: CheckCircle2,
  cancelled: XCircle,
  rejected: XCircle,
};
const TIMELINE_TINT: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-sky-100 text-sky-700',
  en_route: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-200 text-slate-600',
  rejected: 'bg-rose-100 text-rose-700',
};

const STEPS: BookingStatus[] = ['pending', 'accepted', 'en_route', 'in_progress', 'completed'];

function Stepper({ status }: { status: BookingStatus }) {
  if (status === 'cancelled' || status === 'rejected') return null;
  const current = STEPS.indexOf(status);
  return (
    <ol className="flex items-center">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center">
            <span
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                i < current
                  ? 'bg-brand-700 text-white'
                  : i === current
                    ? 'bg-brand-100 text-brand-800 ring-2 ring-brand-700'
                    : 'bg-slate-100 text-slate-400',
              )}
            >
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={clsx(
                'mt-1 hidden text-center text-[11px] sm:block',
                i <= current ? 'text-slate-700' : 'text-slate-400',
              )}
            >
              {STATUS_LABEL[s]}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="relative mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-brand-700"
                initial={{ width: 0 }}
                animate={{ width: i < current ? '100%' : '0%' }}
                transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function Chat({
  booking,
  meId,
  other,
}: {
  booking: Booking;
  meId: string;
  other: { fullName: string; avatarUrl: string | null };
}) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const key = ['messages', booking.id];
  const messages = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{ items: ChatMessage[] }>(`/bookings/${booking.id}/messages`).then((r) => r.items),
  });
  const send = useMutation({
    mutationFn: (body: string) =>
      api<ChatMessage>(`/bookings/${booking.id}/messages`, { method: 'POST', body: { body } }),
    onSuccess: () => setText(''),
  });
  useSocketEvent<{ bookingId: string; message: ChatMessage }>('message.created', (p) => {
    if (p.bookingId !== booking.id) return;
    qc.setQueryData<ChatMessage[]>(key, (old = []) =>
      old.some((m) => m.id === p.message.id) ? old : [...old, p.message],
    );
  });
  // Block body on purpose: scrollIntoView() returns a Promise in newer browsers, and an
  // effect must return nothing or a cleanup function.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.data?.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) send.mutate(text.trim());
  };
  return (
    <div className="card flex h-[30rem] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="relative">
          <Avatar name={other.fullName} url={other.avatarUrl} size="sm" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{other.fullName}</div>
          <div className="text-xs text-slate-500">Messages are saved with this booking</div>
        </div>
        <MessageSquare className="h-4 w-4 text-slate-400" />
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-4">
        {messages.data?.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-[var(--shadow-soft)]">
              <MessageSquare className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-600">No messages yet</p>
            <p className="text-xs text-slate-400">
              Share gate codes, directions or questions here.
            </p>
          </div>
        )}
        {messages.data?.map((m) => (
          <motion.div
            key={m.id}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.95, x: m.senderId === meId ? 20 : -20 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={clsx('flex', m.senderId === meId ? 'justify-end' : 'justify-start')}
          >
            <div
              className={clsx(
                'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                m.senderId === meId
                  ? 'rounded-br-md bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[var(--shadow-soft)]'
                  : 'rounded-bl-md bg-white text-slate-800 shadow-[var(--shadow-soft)] ring-1 ring-slate-100',
              )}
            >
              {m.body}
              <div
                className={clsx(
                  'mt-0.5 text-[10px]',
                  m.senderId === meId ? 'text-brand-100' : 'text-slate-500',
                )}
              >
                {formatTime(m.createdAt)}
              </div>
            </div>
          </motion.div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-slate-100 bg-white p-3">
        <input
          className="input"
          placeholder="Type a message"
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="btn-primary px-3"
          disabled={send.isPending || !text.trim()}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/** Technician side: share GPS, or simulate a drive for demos. */
function LocationSharer({ booking, base }: { booking: Booking; base: LatLng | null }) {
  const [mode, setMode] = useState<'off' | 'gps' | 'sim'>('off');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (mode === 'off') return;
    const emit = (p: LatLng) =>
      getSocket().emit(
        'location:update',
        { bookingId: booking.id, ...p },
        (r: { ok: boolean; error?: string }) => {
          if (!r.ok && r.error !== 'too frequent') setError(r.error ?? 'failed');
        },
      );
    if (mode === 'gps') {
      const id = navigator.geolocation.watchPosition(
        (pos) => emit({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setError('Location permission denied'),
        { enableHighAccuracy: true },
      );
      return () => navigator.geolocation.clearWatch(id);
    }
    // Simulated drive from the technician's base to the customer in ~60 seconds.
    const from = base ?? { lat: booking.lat + 0.02, lng: booking.lng + 0.02 };
    let step = 0;
    const steps = 25;
    const timer = setInterval(() => {
      step = Math.min(step + 1, steps);
      const t = step / steps;
      const wobble = Math.sin(t * Math.PI) * 0.002;
      emit({
        lat: from.lat + (booking.lat - from.lat) * t + wobble,
        lng: from.lng + (booking.lng - from.lng) * t,
      });
      if (step === steps) clearInterval(timer);
    }, 2500);
    return () => clearInterval(timer);
  }, [mode, booking.id, booking.lat, booking.lng, base]);

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Navigation className="h-4 w-4 text-indigo-700" />
        <span className="font-medium text-indigo-900">Share live location with the customer</span>
        <div className="ml-auto flex gap-1">
          {(['off', 'gps', 'sim'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setError(null);
                setMode(m);
              }}
              className={clsx(
                'rounded-md px-2 py-1 text-xs font-semibold',
                mode === m ? 'bg-indigo-700 text-white' : 'bg-white text-indigo-800',
              )}
            >
              {m === 'off' ? 'Off' : m === 'gps' ? 'GPS' : 'Simulate drive'}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function ReviewForm({ booking }: { booking: Booking }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const review = useMutation({
    mutationFn: () =>
      api<Booking>(`/bookings/${booking.id}/review`, {
        method: 'POST',
        body: { rating, comment: comment || undefined },
      }),
    onSuccess: (b) => qc.setQueryData(['booking', booking.id], b),
  });
  return (
    <div className="card p-5">
      <h3 className="font-semibold">How did {booking.technician.fullName.split(' ')[0]} do?</h3>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} stars`}
            role="radio"
            aria-checked={rating === n}
          >
            <Star
              className={clsx(
                'h-8 w-8',
                n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
              )}
            />
          </button>
        ))}
      </div>
      <textarea
        className="input mt-3 min-h-20"
        placeholder="Share details (optional)"
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="mt-2">
        <ErrorBox error={review.error} />
      </div>
      <button
        className="btn-primary mt-3"
        disabled={!rating || review.isPending}
        onClick={() => review.mutate()}
      >
        Submit review
      </button>
    </div>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [techLocation, setTechLocation] = useState<LatLng | null>(null);

  const booking = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api<Booking>(`/bookings/${id}`),
  });
  const myProfile = useQuery({
    queryKey: ['my-tech-profile'],
    queryFn: () => api<{ lat: number; lng: number }>('/technicians/me/profile'),
    enabled: user?.role === 'technician',
  });

  // Join this booking's realtime room (and re-join after reconnects).
  useEffect(() => {
    if (!id) return;
    const s = getSocket();
    const join = () =>
      s.emit(
        'booking:join',
        { bookingId: id },
        (r: { ok: boolean; lastLocation?: LatLng | null }) => {
          if (r.ok && r.lastLocation) setTechLocation(r.lastLocation);
        },
      );
    join();
    s.on('connect', join);
    return () => {
      s.off('connect', join);
      s.emit('booking:leave', { bookingId: id });
    };
  }, [id]);
  useSocketEvent<LatLng & { bookingId: string }>('location.updated', (p) => {
    if (p.bookingId === id) setTechLocation({ lat: p.lat, lng: p.lng });
  });

  const transition = useMutation({
    mutationFn: (body: { to: BookingStatus; reason?: string }) =>
      api<Booking>(`/bookings/${id}/transitions`, { method: 'POST', body }),
    onSuccess: (b) => {
      qc.setQueryData(['booking', id], b);
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      setShowCancel(false);
    },
  });

  const pay = useMutation({
    mutationFn: () =>
      api<{ checkoutUrl: string; providerRef: string }>('/payments', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { bookingId: id },
      }),
    onSuccess: (r) => navigate(`/mockpay/${r.providerRef}`),
  });

  if (booking.isLoading) return <PageLoader />;
  if (booking.error)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorBox error={booking.error} />
      </div>
    );
  const b = booking.data!;
  const isTech = user?.id === b.technician.id;
  const isCustomer = user?.id === b.customer.id;
  const other = isTech ? { ...b.customer, avatarUrl: null } : b.technician;
  const tracking = b.status === 'en_route' || b.status === 'in_progress';
  const actions = b.allowedTransitions.filter((t) => t !== 'cancelled');

  const first = (n: string) => n.split(' ')[0];
  const hero: Record<
    BookingStatus,
    { title: string; text: string; tone: string; icon: typeof Clock }
  > = {
    pending: isTech
      ? {
          title: 'New job request',
          text: `${first(b.customer.fullName)} wants to book you. Accept or decline below.`,
          tone: 'from-amber-500 to-orange-600',
          icon: BellRing,
        }
      : {
          title: 'Request sent',
          text: `Waiting for ${first(b.technician.fullName)} to accept. You'll be notified instantly.`,
          tone: 'from-amber-500 to-orange-600',
          icon: Clock,
        },
    accepted: isTech
      ? {
          title: 'Job confirmed',
          text: 'Press "Start travelling" when you leave so the customer can follow you.',
          tone: 'from-sky-500 to-blue-700',
          icon: CalendarCheck,
        }
      : {
          title: 'Booking confirmed',
          text: `${first(b.technician.fullName)} will arrive on ${formatDateTime(b.startAt)}.`,
          tone: 'from-sky-500 to-blue-700',
          icon: CalendarCheck,
        },
    en_route: isTech
      ? {
          title: 'You are on the way',
          text: 'Share your live location below so the customer can see you approach.',
          tone: 'from-indigo-500 to-violet-700',
          icon: Navigation,
        }
      : {
          title: `${first(b.technician.fullName)} is on the way`,
          text: 'Follow their live location on the map below.',
          tone: 'from-indigo-500 to-violet-700',
          icon: Navigation,
        },
    in_progress: {
      title: 'Work in progress',
      text: 'The technician is working on the job now.',
      tone: 'from-violet-500 to-fuchsia-700',
      icon: Wrench,
    },
    completed:
      b.paymentStatus === 'succeeded'
        ? {
            title: 'All done & paid',
            text: 'Thanks for using TechFinder. This job is complete.',
            tone: 'from-brand-500 to-brand-800',
            icon: CheckCircle2,
          }
        : {
            title: 'Job completed',
            text: isTech
              ? 'Waiting for the customer to pay.'
              : 'Please pay and rate your technician.',
            tone: 'from-brand-500 to-brand-800',
            icon: CheckCircle2,
          },
    cancelled: {
      title: 'Booking cancelled',
      text: b.cancelReason ? `Reason: “${b.cancelReason}”` : 'This booking was cancelled.',
      tone: 'from-slate-500 to-slate-700',
      icon: XCircle,
    },
    rejected: {
      title: 'Request declined',
      text: isTech
        ? 'You declined this job.'
        : "The technician couldn't take this job. Please book someone else.",
      tone: 'from-rose-500 to-rose-700',
      icon: XCircle,
    },
  };
  const h = hero[b.status];

  return (
    <div>
      <motion.div
        key={b.status}
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${h.tone} p-6 text-white shadow-[var(--shadow-lift)] sm:p-8`}
      >
        <div className="tf-aurora absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        <div className="bg-grid absolute inset-0 opacity-50" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            {!['completed', 'cancelled', 'rejected'].includes(b.status) && (
              <span className="absolute inset-0 animate-ping rounded-2xl bg-white/25" />
            )}
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.15 }}
            >
              <h.icon className="relative h-7 w-7" />
            </motion.span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white/80">
              {b.category.name} · {formatDateTime(b.startAt)} – {formatTime(b.endAt)}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">{h.title}</h1>
            <p className="mt-1 text-white/85">{h.text}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-5 py-3 text-right ring-1 ring-white/25 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/75">
              {b.paymentStatus === 'succeeded' ? 'Paid' : 'Quoted price'}
            </div>
            <div className="text-2xl font-extrabold">{taka(b.quotedPriceBdt)}</div>
          </div>
        </div>
      </motion.div>

      {b.status !== 'cancelled' && b.status !== 'rejected' && (
        <div className="card mt-6 p-5 sm:px-8">
          <Stepper status={b.status} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <div className="card p-5">
            <div className="flex items-center gap-4">
              <Avatar name={other.fullName} url={other.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isTech ? 'Customer' : 'Your technician'}
                </div>
                <div className="flex items-center gap-1 text-lg font-bold">
                  {other.fullName} {!isTech && <Verified className="h-[18px] w-[18px]" />}
                </div>
                <div className="flex items-center gap-1 truncate text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {b.address}
                </div>
              </div>
              {other.phone && b.status !== 'pending' && (
                <a href={`tel:${other.phone}`} className="btn-secondary">
                  <Phone className="h-4 w-4" /> Call
                </a>
              )}
            </div>
            {b.problemDescription && (
              <p className="mt-4 rounded-xl border-l-4 border-brand-300 bg-slate-50 p-3.5 text-sm text-slate-700">
                {b.problemDescription}
              </p>
            )}

            {(actions.length > 0 || b.allowedTransitions.includes('cancelled')) && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {actions.map((to) => (
                  <button
                    key={to}
                    className={to === 'rejected' ? 'btn-danger' : 'btn-primary'}
                    disabled={transition.isPending}
                    onClick={() => transition.mutate({ to })}
                  >
                    {transition.isPending && transition.variables?.to === to && (
                      <Spinner className="h-4 w-4 text-white" />
                    )}
                    {ACTION_LABEL[to]}
                  </button>
                ))}
                {b.allowedTransitions.includes('cancelled') && !showCancel && (
                  <button className="btn-danger" onClick={() => setShowCancel(true)}>
                    Cancel booking
                  </button>
                )}
              </div>
            )}
            {showCancel && (
              <div className="mt-3 flex gap-2">
                <input
                  className="input"
                  placeholder="Reason for cancelling"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <button
                  className="btn-danger shrink-0"
                  disabled={!cancelReason.trim()}
                  onClick={() => transition.mutate({ to: 'cancelled', reason: cancelReason })}
                >
                  Confirm
                </button>
              </div>
            )}
            <div className="mt-3">
              <ErrorBox error={transition.error} />
            </div>
          </div>

          {(tracking || techLocation) && (
            <div className="space-y-3">
              {isTech && tracking && <LocationSharer booking={b} base={myProfile.data ?? null} />}
              <TrackingMap destination={{ lat: b.lat, lng: b.lng }} technician={techLocation} />
              {isCustomer && !techLocation && tracking && (
                <p className="text-sm text-slate-500">
                  Waiting for the technician's live location…
                </p>
              )}
            </div>
          )}

          {isCustomer && b.status === 'completed' && b.paymentStatus !== 'succeeded' && (
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-amber-50 to-white p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-ink-900">
                  <CreditCard className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-extrabold">Payment due · {taka(b.quotedPriceBdt)}</h3>
                  <p className="text-sm text-slate-500">
                    The job is done. Pay securely, then rate your technician.
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {['bKash', 'Nagad', 'Visa', 'Mastercard'].map((m) => (
                      <span
                        key={m}
                        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  className="btn-primary px-6 py-3"
                  onClick={() => pay.mutate()}
                  disabled={pay.isPending}
                >
                  {pay.isPending ? (
                    <Spinner className="h-4 w-4 text-white" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}{' '}
                  Pay now
                </button>
              </div>
              {pay.error && (
                <div className="px-6 pb-4">
                  <ErrorBox error={pay.error} />
                </div>
              )}
            </div>
          )}
          {isCustomer && b.status === 'completed' && !b.review && <ReviewForm booking={b} />}
          {b.review && (
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{isTech ? 'Customer review' : 'Your review'}</h3>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={clsx(
                        'h-5 w-5',
                        n <= b.review!.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200',
                      )}
                    />
                  ))}
                </div>
              </div>
              {b.review.comment && (
                <blockquote className="mt-3 rounded-xl bg-slate-50 p-4 text-sm italic leading-relaxed text-slate-700">
                  “{b.review.comment}”
                </blockquote>
              )}
            </div>
          )}

          <Section
            icon={History}
            title="Activity"
            description="Every change to this booking, in order"
          >
            <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-0.5 before:bg-slate-100">
              {b.timeline.map((e, i) => {
                const Icon = TIMELINE_ICON[e.to];
                return (
                  <motion.li
                    key={i}
                    className="relative flex gap-4"
                    initial={{ opacity: 0, x: -14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span
                      className={clsx(
                        'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white',
                        TIMELINE_TINT[e.to],
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="pt-1.5 text-sm">
                      <div className="font-bold text-slate-900">{STATUS_LABEL[e.to]}</div>
                      <div className="text-slate-500">
                        {formatDateTime(e.at)}
                        {e.actorName ? ` · by ${e.actorName}` : ''}
                      </div>
                      {e.note && (
                        <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                          “{e.note}”
                        </div>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </Section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Section icon={Receipt} title="Booking details">
            <dl className="space-y-3 text-sm">
              {[
                [
                  CalendarCheck,
                  'Date',
                  new Date(b.startAt).toLocaleDateString('en-GB', {
                    timeZone: 'Asia/Dhaka',
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  }),
                ],
                [
                  Clock,
                  'Time',
                  `${formatTime(b.startAt)} – ${formatTime(b.endAt)} (${Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 3600_000)}h)`,
                ],
                [MapPin, 'Address', b.address],
                [Hash, 'Reference', `TF-${b.id.slice(0, 8).toUpperCase()}`],
              ].map(([Icon, label, value]) => {
                const I = Icon as typeof Clock;
                return (
                  <div key={label as string} className="flex gap-3">
                    <I className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <dt className="w-20 shrink-0 text-slate-500">{label as string}</dt>
                    <dd className="min-w-0 flex-1 font-semibold text-slate-800">
                      {value as string}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>{b.category.name}</span>
                <span>{taka(b.quotedPriceBdt)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Booking fee</span>
                <span className="font-semibold text-brand-700">Free</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-extrabold text-slate-900">
                <span>Total</span>
                <span className="flex items-center gap-2">
                  {b.paymentStatus === 'succeeded' && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      PAID
                    </span>
                  )}
                  {taka(b.quotedPriceBdt)}
                </span>
              </div>
            </div>
          </Section>
          {user && (isTech || isCustomer) && (
            <div id="chat" className="lg:sticky lg:top-24">
              <Chat booking={b} meId={user.id} other={other} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
