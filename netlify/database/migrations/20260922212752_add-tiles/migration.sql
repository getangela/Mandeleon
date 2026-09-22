-- Admin Dashboard — see todo.html "Content management". Moves every
-- product/video tile out of the hand-edited PRODUCTS array in index.html
-- and into a real table, so tiles can be added/edited/deleted from
-- admin.html with no code. index.html itself doesn't change how it reads
-- tiles at runtime (it still gets a plain PRODUCTS array) — what changes is
-- WHERE that array comes from: instead of being typed directly into the
-- file, it's now exported from this table on demand (see the
-- tiles-admin-export function) into a fresh index.html to upload.
--
-- Column choices mirror the current PRODUCTS object shape field-for-field
-- (see gamification-spec.md and the live site) so the one-time import can
-- carry every existing tile over exactly as it is today, with nothing lost
-- or reinterpreted:
--   cats, icon, color, name, note, desc, affiliate, img, link, dateAdded,
--   type, youtubeId, noEmbed, source, exoticsLinked, hideBadge
--
-- Two real changes from the current hardcoded setup, both additive:
--
-- 1. `slug` is now a real, frozen column instead of being recomputed at
--    every page load from the product's position in the array. Today's
--    runtime slugify() falls back to appending the array index on a name
--    collision — which means DELETING or REORDERING tiles could silently
--    change another tile's slug, breaking anyone's saved favorites, board
--    memberships, or feed history that reference the old one. The one-time
--    import computes each tile's slug to match exactly what the live site
--    already computes for it today, then freezes it here for good —
--    editing a tile's name later never changes its slug.
--
-- 2. `gadget_meter` replaces the hardcoded GADGET_METER_BY_NAME lookup
--    (a plain name -> meter map that lived in index.html's JS, invisible
--    to admin.html) with a real column any Gadgets tile can set directly
--    from the dashboard. Exotics' own meter-mapping is intentionally LEFT
--    AS-IS (the cross-listed-twin-by-matching-name system in index.html,
--    unchanged) rather than flattened here — it's load-bearing for the
--    Exotics 18+ gate and the "All" view's de-duplication too, not just
--    feeding, so it stays exactly as tested and working today. This table
--    still carries `exotics_linked` as a plain passthrough column so that
--    existing (and any new) twin pairs keep working unchanged.
CREATE TABLE IF NOT EXISTS tiles (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'product',   -- 'product' | 'video'
  name TEXT NOT NULL,
  cats JSONB NOT NULL DEFAULT '[]'::jsonb,
  icon TEXT,
  color TEXT,
  note TEXT,
  desc TEXT,
  affiliate BOOLEAN,
  img TEXT,               -- base64 data: URI; null for videos
  link TEXT,
  youtube_id TEXT,         -- video tiles only
  no_embed BOOLEAN,
  source TEXT,             -- e.g. a credited scout/creator name
  exotics_linked BOOLEAN NOT NULL DEFAULT false,
  hide_badge BOOLEAN NOT NULL DEFAULT false,
  gadget_meter TEXT,       -- one of the 8 meter keys, Gadgets tiles only
  date_added DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
