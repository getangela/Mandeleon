sql
-- Personal boards (Pinterest-style) — see todo.html "User accounts &
-- personal boards". Account-only, same as the rest of Visitor Accounts —
-- a board is a named grouping a logged-in visitor creates; a tile is added
-- to a board independently of the existing flat `saved_tiles` list (a
-- board membership doesn't require the tile to also be in the plain
-- Favorites list, and vice versa — the two are related concepts but not
-- the same one, same as a Pinterest pin can exist outside any board).
-- A tile can belong to more than one board at once (many-to-many), which
-- is why this is a real join table rather than a single board_id column
-- on saved_tiles.

CREATE TABLE IF NOT EXISTS boards (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Case-insensitive uniqueness per account (mirrors the avatars table's
  -- name_lower pattern) — "Sleep Stack" and "sleep stack" shouldn't be able
  -- to exist as two different boards for the same person by accident.
  name_lower TEXT GENERATED ALWAYS AS (LOWER(name)) STORED
);
CREATE UNIQUE INDEX IF NOT EXISTS boards_user_name_unique ON boards (user_id, name_lower);

CREATE TABLE IF NOT EXISTS board_tiles (
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, slug)
);
