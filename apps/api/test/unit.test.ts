import { describe, expect, it } from 'vitest';
import {
  acceptanceRate,
  bayesianRating,
  rank,
  PRIOR_MEAN,
} from '../src/modules/technicians/ranking.js';
import {
  allowedTransitions,
  canTransition,
  isTerminal,
} from '../src/modules/bookings/booking-state.js';

describe('ranking', () => {
  const base = {
    distanceKm: 2,
    maxDistanceKm: 10,
    jobsOffered: 20,
    jobsAccepted: 18,
    experienceYears: 5,
  };

  it('pulls technicians with few reviews toward the prior', () => {
    expect(bayesianRating(0, 0)).toBe(PRIOR_MEAN);
    expect(bayesianRating(5, 1)).toBeLessThan(4.2);
  });

  it('ranks 200 reviews at 4.8 above a single 5-star review', () => {
    const veteran = rank({ ...base, ratingSum: 960, ratingCount: 200 });
    const newcomer = rank({ ...base, ratingSum: 5, ratingCount: 1 });
    expect(veteran.score).toBeGreaterThan(newcomer.score);
  });

  it('prefers closer technicians when everything else is equal', () => {
    const near = rank({ ...base, distanceKm: 1, ratingSum: 45, ratingCount: 10 });
    const far = rank({ ...base, distanceKm: 9, ratingSum: 45, ratingCount: 10 });
    expect(near.score).toBeGreaterThan(far.score);
  });

  it('keeps every component within [0, 1]', () => {
    const r = rank({
      distanceKm: 50,
      maxDistanceKm: 10,
      ratingSum: 0,
      ratingCount: 0,
      jobsOffered: 0,
      jobsAccepted: 0,
      experienceYears: 40,
    });
    for (const v of Object.values(r.components)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('smooths acceptance rate so 1/1 is not perfect', () => {
    expect(acceptanceRate(1, 1)).toBeCloseTo(2 / 3);
    expect(acceptanceRate(100, 95)).toBeGreaterThan(acceptanceRate(1, 1));
  });
});

describe('booking state machine', () => {
  it('lets only the technician accept', () => {
    expect(canTransition('pending', 'accepted', 'technician')).toBe(true);
    expect(canTransition('pending', 'accepted', 'customer')).toBe(false);
  });

  it('forbids skipping steps', () => {
    expect(canTransition('pending', 'completed', 'technician')).toBe(false);
    expect(canTransition('accepted', 'in_progress', 'technician')).toBe(false);
  });

  it('does not let a customer cancel once the technician is on the way', () => {
    expect(canTransition('en_route', 'cancelled', 'customer')).toBe(false);
    expect(canTransition('en_route', 'cancelled', 'admin')).toBe(true);
  });

  it('treats completed, cancelled and rejected as terminal', () => {
    for (const s of ['completed', 'cancelled', 'rejected'] as const) {
      expect(isTerminal(s)).toBe(true);
      expect(allowedTransitions(s, 'admin')).toEqual([]);
    }
  });
});
