// GET /.netlify/functions/boards-list  ->  { boards: [{ id, name, slugs: [...] }, ...] }
// Requires login. Personal boards (Pinterest-style) — see todo.html "User
// accounts & personal boards". Returns every board this account has, each
// with the full list of slugs saved into it, in one round trip — the
// frontend's Boards panel (renderBoardsPanel() in index.html) fetches this
// fresh every time it opens rather than trying to keep a local cache in
// sync, since boards are an account-only feature with no localStorage
// fallback to reconcile against (unlike the avatar/flat-Favorites list).
const { getDb, ensureUser, requireUser, json } = require('./_lib/db');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const user = requireUser(context);
  if (!user) return json(401, { error: 'Not logged in' });

  try {
    await ensureUser(user);
    const db = getDb();
    const rows = await db.sql`
      SELECT b.id, b.name, bt.slug
      FROM boards b
      LEFT JOIN board_tiles bt ON bt.board_id = b.id
      WHERE b.user_id = ${user.sub}
      ORDER BY b.created_at ASC, bt.added_at ASC
    `;
    const boardsById = new Map();
    for (const row of rows) {
      if (!boardsById.has(row.id)) {
        boardsById.set(row.id, { id: row.id, name: row.name, slugs: [] });
      }
      if (row.slug) boardsById.get(row.id).slugs.push(row.slug);
    }
    return json(200, { boards: Array.from(boardsById.values()) });
  } catch (err) {
    console.error('boards-list failed', err);
    return json(500, { error: 'Lookup failed' });
  }
};
