import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCircle2, CreditCard, Star } from 'lucide-react';
import { useSocketEvent } from './socket';
import { STATUS_LABEL } from './format';
import type { BookingStatus } from './types';

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  href?: string;
  at: number;
  read: boolean;
  kind: 'booking' | 'payment' | 'review' | 'request';
}

interface NotificationsState {
  items: AppNotification[];
  unread: number;
  markAllRead: () => void;
}

const Ctx = createContext<NotificationsState>({ items: [], unread: 0, markAllRead: () => {} });
export const useNotifications = () => useContext(Ctx);

const ICON = { booking: CheckCircle2, payment: CreditCard, review: Star, request: BellRing };

/**
 * Turns realtime socket events into (1) fresh data, by invalidating the right
 * queries, (2) a short toast, and (3) an entry in the notification bell.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);

  const push = useCallback((n: Omit<AppNotification, 'id' | 'at' | 'read'>) => {
    const item = { ...n, id: Date.now() + Math.random(), at: Date.now(), read: false };
    setItems((xs) => [item, ...xs].slice(0, 30));
    setToasts((xs) => [...xs, item]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== item.id)), 5000);
  }, []);

  const refreshBooking = (id: string) => {
    void qc.invalidateQueries({ queryKey: ['bookings'] });
    void qc.invalidateQueries({ queryKey: ['booking', id] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
  };

  useSocketEvent<{ bookingId: string; status: BookingStatus }>('booking.updated', (p) => {
    refreshBooking(p.bookingId);
    push({
      kind: 'booking',
      title: STATUS_LABEL[p.status] ?? 'Booking updated',
      body: 'Your booking status changed.',
      href: `/bookings/${p.bookingId}`,
    });
  });
  useSocketEvent<{ bookingId: string }>('booking.created', (p) => {
    refreshBooking(p.bookingId);
    push({
      kind: 'request',
      title: 'New job request',
      body: 'A customer wants to book you.',
      href: `/bookings/${p.bookingId}`,
    });
  });
  useSocketEvent<{ bookingId: string }>('payment.updated', (p) => {
    refreshBooking(p.bookingId);
    push({
      kind: 'payment',
      title: 'Payment received',
      body: 'The job has been paid.',
      href: `/bookings/${p.bookingId}`,
    });
  });
  useSocketEvent<{ bookingId: string; rating: number }>('review.created', (p) => {
    void qc.invalidateQueries({ queryKey: ['my-tech-profile'] });
    push({
      kind: 'review',
      title: `New ${p.rating}★ review`,
      body: 'A customer rated your work.',
      href: `/bookings/${p.bookingId}`,
    });
  });

  const value = useMemo(
    () => ({
      items,
      unread: items.filter((i) => !i.read).length,
      markAllRead: () => setItems((xs) => xs.map((x) => ({ ...x, read: true }))),
    }),
    [items],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex w-80 flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const Icon = ICON[t.kind];
          const inner = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-brand-300">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{t.title}</span>
                <span className="block truncate text-xs text-slate-400">{t.body}</span>
              </span>
            </>
          );
          const cls =
            'pointer-events-auto flex animate-fade-up items-center gap-3 rounded-2xl bg-ink-900 p-3 text-white shadow-[var(--shadow-lift)] ring-1 ring-white/10';
          return t.href ? (
            <Link key={t.id} to={t.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <div key={t.id} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const NOTIFICATION_ICON = ICON;
