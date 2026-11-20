import type { Role } from '../../lib/tokens.js';

export const BOOKING_STATUSES = [
  'pending',
  'accepted',
  'en_route',
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ACTIVE_STATUSES: readonly BookingStatus[] = [
  'pending',
  'accepted',
  'en_route',
  'in_progress',
];

/**
 * The booking lifecycle as an explicit state machine: for each status, which
 * next statuses are allowed and which roles may make that move. Anything not
 * listed here is rejected, so there is no way to e.g. jump from "pending" to
 * "completed" or reopen a cancelled job.
 *
 *   pending ──accept──▶ accepted ──▶ en_route ──▶ in_progress ──▶ completed
 *      │ reject            │ cancel     │ cancel(admin)  │ cancel(admin)
 *      ▼                   ▼            ▼                ▼
 *   rejected            cancelled    cancelled        cancelled
 */
const TRANSITIONS: Record<BookingStatus, Partial<Record<BookingStatus, readonly Role[]>>> = {
  pending: {
    accepted: ['technician'],
    rejected: ['technician'],
    cancelled: ['customer', 'technician', 'admin'],
  },
  accepted: {
    en_route: ['technician'],
    cancelled: ['customer', 'technician', 'admin'],
  },
  en_route: {
    in_progress: ['technician'],
    cancelled: ['admin'],
  },
  in_progress: {
    completed: ['technician'],
    cancelled: ['admin'],
  },
  completed: {},
  cancelled: {},
  rejected: {},
};

export function allowedTransitions(from: BookingStatus, role: Role): BookingStatus[] {
  return Object.entries(TRANSITIONS[from])
    .filter(([, roles]) => roles?.includes(role))
    .map(([to]) => to as BookingStatus);
}

export function canTransition(from: BookingStatus, to: BookingStatus, role: Role): boolean {
  return TRANSITIONS[from][to]?.includes(role) ?? false;
}

export const isTerminal = (s: BookingStatus) => Object.keys(TRANSITIONS[s]).length === 0;
