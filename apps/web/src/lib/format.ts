import type { BookingStatus } from './types';

export const taka = (n: number) => `৳${n.toLocaleString('en-IN')}`;

const dhaka = { timeZone: 'Asia/Dhaka' } as const;
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    ...dhaka,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    ...dhaka,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { ...dhaka, hour: 'numeric', minute: '2-digit' });

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Waiting for technician',
  accepted: 'Accepted',
  en_route: 'On the way',
  in_progress: 'Work in progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Declined',
};

export const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  accepted: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  en_route: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  in_progress: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  rejected: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
};

/** Label for the button that moves a booking into `to`. */
export const ACTION_LABEL: Record<BookingStatus, string> = {
  pending: '',
  accepted: 'Accept job',
  rejected: 'Decline',
  en_route: 'Start travelling',
  in_progress: 'Start work',
  completed: 'Mark as completed',
  cancelled: 'Cancel booking',
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
