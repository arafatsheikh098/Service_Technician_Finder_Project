/**
 * Technician ranking.
 *
 * A raw average rating is misleading: one 5-star review beats two hundred 4.9s.
 * We use a Bayesian average that pulls technicians with few reviews toward a
 * prior mean, then blend it with proximity, reliability and experience.
 * Every component is in [0, 1], and the breakdown is returned to the client so
 * the UI can explain why someone is ranked where they are.
 */

export const PRIOR_MEAN = 4.0; // what we assume about a technician with no reviews
export const PRIOR_WEIGHT = 5; // how many "virtual" reviews that assumption is worth

export const WEIGHTS = {
  rating: 0.45,
  proximity: 0.3,
  reliability: 0.15,
  experience: 0.1,
} as const;

export interface RankInput {
  distanceKm: number;
  maxDistanceKm: number;
  ratingSum: number;
  ratingCount: number;
  jobsOffered: number;
  jobsAccepted: number;
  experienceYears: number;
}

export interface RankBreakdown {
  score: number;
  bayesianRating: number;
  components: { rating: number; proximity: number; reliability: number; experience: number };
}

export function bayesianRating(sum: number, count: number): number {
  return (PRIOR_WEIGHT * PRIOR_MEAN + sum) / (PRIOR_WEIGHT + count);
}

/** Laplace-smoothed acceptance rate, so 1/1 doesn't count as a perfect record. */
export function acceptanceRate(offered: number, accepted: number): number {
  return (accepted + 1) / (offered + 2);
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function rank(input: RankInput): RankBreakdown {
  const bayes = bayesianRating(input.ratingSum, input.ratingCount);
  const components = {
    rating: clamp01((bayes - 1) / 4), // 1..5 stars -> 0..1
    proximity: input.maxDistanceKm > 0 ? clamp01(1 - input.distanceKm / input.maxDistanceKm) : 1,
    reliability: clamp01(acceptanceRate(input.jobsOffered, input.jobsAccepted)),
    experience: clamp01(input.experienceYears / 10), // saturates at 10 years
  };
  const score =
    WEIGHTS.rating * components.rating +
    WEIGHTS.proximity * components.proximity +
    WEIGHTS.reliability * components.reliability +
    WEIGHTS.experience * components.experience;

  const round = (x: number) => Math.round(x * 1000) / 1000;
  return {
    score: round(score),
    bayesianRating: Math.round(bayes * 100) / 100,
    components: {
      rating: round(components.rating),
      proximity: round(components.proximity),
      reliability: round(components.reliability),
      experience: round(components.experience),
    },
  };
}
