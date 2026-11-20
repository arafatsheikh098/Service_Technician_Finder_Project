-- TechFinder schema v2.
-- Design notes are in docs/ARCHITECTURE.md. The important invariants are enforced
-- here, in the database, not only in application code:
--   * a technician can never have two overlapping active bookings (exclusion constraint)
--   * a booking can be reviewed at most once, only after it is completed (PK + trigger)
--   * ratings, prices and radii are range-checked

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('customer', 'technician', 'admin');

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 100),
  phone         text,
  role          user_role NOT NULL DEFAULT 'customer',
  avatar_url    text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Refresh tokens are rotated on every use. All tokens issued from one login share a
-- family_id; if a token that was already rotated is presented again (a replay, which
-- means it was stolen), the whole family is revoked.
CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   uuid NOT NULL,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  rotated_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

CREATE TABLE password_reset_tokens (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE TABLE service_categories (
  id              serial PRIMARY KEY,
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  name_bn         text,
  description     text,
  base_price_bdt  integer NOT NULL CHECK (base_price_bdt >= 0)
);

CREATE TABLE technician_profiles (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio                text CHECK (length(bio) <= 1000),
  experience_years   integer NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 60),
  hourly_rate_bdt    integer NOT NULL CHECK (hourly_rate_bdt BETWEEN 100 AND 100000),
  location           geography(Point, 4326) NOT NULL,
  area_label         text,
  service_radius_km  numeric(5, 2) NOT NULL DEFAULT 10 CHECK (service_radius_km BETWEEN 1 AND 100),
  is_verified        boolean NOT NULL DEFAULT false,
  is_available       boolean NOT NULL DEFAULT true,
  -- Denormalised counters, updated in the same transaction as the source rows.
  rating_sum         integer NOT NULL DEFAULT 0,
  rating_count       integer NOT NULL DEFAULT 0,
  jobs_offered       integer NOT NULL DEFAULT 0,
  jobs_accepted      integer NOT NULL DEFAULT 0,
  jobs_completed     integer NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX technician_profiles_location_gix ON technician_profiles USING gist (location);
CREATE INDEX technician_profiles_searchable_idx ON technician_profiles (is_verified, is_available);

CREATE TABLE technician_services (
  technician_id  uuid NOT NULL REFERENCES technician_profiles(user_id) ON DELETE CASCADE,
  category_id    integer NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (technician_id, category_id)
);
CREATE INDEX technician_services_category_idx ON technician_services (category_id);

CREATE TYPE booking_status AS ENUM (
  'pending', 'accepted', 'en_route', 'in_progress', 'completed', 'cancelled', 'rejected'
);

CREATE TABLE bookings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id          uuid NOT NULL REFERENCES users(id),
  technician_id        uuid NOT NULL REFERENCES technician_profiles(user_id),
  category_id          integer NOT NULL REFERENCES service_categories(id),
  status               booking_status NOT NULL DEFAULT 'pending',
  slot                 tstzrange NOT NULL,
  address              text NOT NULL CHECK (length(address) BETWEEN 3 AND 300),
  location             geography(Point, 4326) NOT NULL,
  problem_description  text CHECK (length(problem_description) <= 2000),
  quoted_price_bdt     integer NOT NULL CHECK (quoted_price_bdt >= 0),
  cancel_reason        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_slot_valid CHECK (
    NOT isempty(slot) AND lower(slot) < upper(slot) AND upper(slot) - lower(slot) <= interval '8 hours'
  ),
  CONSTRAINT bookings_not_self CHECK (customer_id <> technician_id),
  -- The core guarantee: no double booking, even under concurrent requests.
  -- Postgres rejects the second INSERT/UPDATE with SQLSTATE 23P01.
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    technician_id WITH =,
    slot WITH &&
  ) WHERE (status IN ('pending', 'accepted', 'en_route', 'in_progress'))
);
CREATE INDEX bookings_customer_idx ON bookings (customer_id, created_at DESC);
CREATE INDEX bookings_technician_idx ON bookings (technician_id, created_at DESC);

-- Append-only audit log of every state change.
CREATE TABLE booking_events (
  id           bigserial PRIMARY KEY,
  booking_id   uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status  booking_status,
  to_status    booking_status NOT NULL,
  actor_id     uuid REFERENCES users(id),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_events_booking_idx ON booking_events (booking_id, id);

CREATE TABLE reviews (
  booking_id     uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id    uuid NOT NULL REFERENCES users(id),
  technician_id  uuid NOT NULL REFERENCES technician_profiles(user_id),
  rating         smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        text CHECK (length(comment) <= 1000),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_technician_idx ON reviews (technician_id, created_at DESC);

CREATE TABLE messages (
  id          bigserial PRIMARY KEY,
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES users(id),
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_booking_idx ON messages (booking_id, id);

CREATE TYPE payment_status AS ENUM ('initiated', 'succeeded', 'failed', 'refunded');

CREATE TABLE payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES bookings(id),
  amount_bdt    integer NOT NULL CHECK (amount_bdt > 0),
  status        payment_status NOT NULL DEFAULT 'initiated',
  provider      text NOT NULL,
  provider_ref  text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- At most one successful payment per booking.
CREATE UNIQUE INDEX payments_one_success_per_booking
  ON payments (booking_id) WHERE status = 'succeeded';

-- Idempotency-Key support for unsafe POSTs (booking creation, payments).
CREATE TABLE idempotency_keys (
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key              text NOT NULL,
  request_hash     text NOT NULL,
  response_status  integer,
  response_body    jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- Keep updated_at honest without relying on every UPDATE remembering it.
CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER technician_profiles_touch BEFORE UPDATE ON technician_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER bookings_touch BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER payments_touch BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Reviews: only the booking's customer, only once the job is completed, and the
-- technician's rating counters are kept in step atomically.
CREATE FUNCTION reviews_apply() RETURNS trigger AS $$
DECLARE
  b bookings%ROWTYPE;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = NEW.booking_id;
  IF b.status <> 'completed' THEN
    RAISE EXCEPTION 'booking % is not completed', NEW.booking_id USING ERRCODE = 'check_violation';
  END IF;
  IF b.customer_id <> NEW.customer_id OR b.technician_id <> NEW.technician_id THEN
    RAISE EXCEPTION 'review does not match booking' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE technician_profiles
     SET rating_sum = rating_sum + NEW.rating,
         rating_count = rating_count + 1
   WHERE user_id = NEW.technician_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_apply_trg BEFORE INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION reviews_apply();
