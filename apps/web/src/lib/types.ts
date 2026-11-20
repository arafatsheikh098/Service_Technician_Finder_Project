export type Role = 'customer' | 'technician' | 'admin';
export type BookingStatus =
  'pending' | 'accepted' | 'en_route' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  nameBn: string | null;
  description: string | null;
  basePriceBdt: number;
}

export interface RankBreakdown {
  score: number;
  bayesianRating: number;
  components: { rating: number; proximity: number; reliability: number; experience: number };
}

export interface TechnicianSummary {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  areaLabel: string | null;
  experienceYears: number;
  hourlyRateBdt: number;
  distanceKm: number;
  lat: number;
  lng: number;
  ratingAvg: number | null;
  ratingCount: number;
  jobsCompleted: number;
  categories: string[];
  rank: RankBreakdown;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TechnicianProfile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  memberSince: string;
  bio: string | null;
  experienceYears: number;
  hourlyRateBdt: number;
  areaLabel: string | null;
  serviceRadiusKm: number;
  isVerified: boolean;
  isAvailable: boolean;
  lat: number;
  lng: number;
  ratingAvg: number | null;
  ratingCount: number;
  acceptanceRate: number | null;
  jobsCompleted: number;
  categories: { id: number; slug: string; name: string }[];
  recentReviews: {
    rating: number;
    comment: string | null;
    createdAt: string;
    customerName: string;
  }[];
}

export interface Booking {
  id: string;
  status: BookingStatus;
  address: string;
  problemDescription: string | null;
  quotedPriceBdt: number;
  cancelReason: string | null;
  startAt: string;
  endAt: string;
  lat: number;
  lng: number;
  createdAt: string;
  category: { id: number; slug: string; name: string };
  customer: { id: string; fullName: string; phone: string | null };
  technician: { id: string; fullName: string; phone: string | null; avatarUrl: string | null };
  paymentStatus: 'initiated' | 'succeeded' | 'failed' | 'refunded' | null;
  review: { rating: number; comment: string | null } | null;
}

export interface BookingDetail extends Booking {
  allowedTransitions: BookingStatus[];
  timeline: {
    from: BookingStatus | null;
    to: BookingStatus;
    note: string | null;
    at: string;
    actorName: string | null;
  }[];
}

export interface ChatMessage {
  id: number;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
}

export interface TriageResult {
  category: { slug: string; name: string } | null;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  summary: string;
  safetyAdvice: string | null;
  estimatedHours: number;
  priceRangeBdt: { min: number; max: number } | null;
  confidence: number;
  source: 'ai' | 'keywords';
}
