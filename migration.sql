-- Visitor Accounts (see gamification-spec.md + todo.html "Visitor Accounts" milestone).
-- Moves avatar/favorites state from localStorage-only into a per-account
-- record so it survives across devices, once a visitor chooses to log in.
-- Guest (never-logged-in) visitors are entirely unaffected — their avatar
-- keeps living in localStorage exactly as it always has.

-- One row per Netlify Identity account. id is the Identity user's own
-- UUID (sub claim), so no separate mapping table is needed.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- The avatar itself is stored as a single JSONB blob (the same shape as the
-- localStorage object createAvatar()/saveAvatar() already produce: meters,
-- feedCounts, dailyGain, everFed, careScore, careStreak, etc.) rather than
-- one column per field. That keeps this table stable while the avatar's
-- internal shape keeps evolving (new meters, new tracked fields) — only the
-- name needs its own real column, because avatar names must be globally
-- unique (case-insensitively) once an avatar is tied to a real account, per
-- the upcoming cross-account leaderboard (Cohort Tiers).
CREATE TABLE IF NOT EXISTS avatars (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_lower TEXT GENERATED ALWAYS AS (LOWER(name)) STORED,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS avatars_name_lower_unique ON avatars (name_lower);

-- Mirrors the existing localStorage "saved" Set (favorites board) for a
-- logged-in account. One row per saved product slug.
CREATE TABLE IF NOT EXISTS saved_tiles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  saved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, slug)
);
