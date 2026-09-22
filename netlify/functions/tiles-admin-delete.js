// POST /.netlify/functions/tiles-admin-delete   body: { id }
// Admin-only. Deletes one tile permanently. admin.html requires typing the
// tile's name to confirm before this is ever called — same guarded pattern
// as the visitor-facing "Delete my account" flow — since there's no undo
// here (unlike a visitor's own avatar/account, an admin accidentally
// deleting a live tile has no self-service recovery path at all).
//
// Deliberately does NOT touch saved_tiles or board_tiles rows that
// reference this tile's slug elsewhere — a visitor who'd saved/boarded it
// keeps that reference; it just won't resolve to a real product anymore
// (the same outcome as removing a tile from the old hardcoded array always
// had, just now reachable without editing code).
const { getDb, requireAdmin, json } = require('./_lib/db');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const admin = requireAdmin(context);
  if (!admin) return json(403, { error: 'Admin access required' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const id = Number(body.id);
  if (!id) return json(400, { error: 'Missing id' });

  try {
    const db = getDb();
    const rows = await db.sql`DELETE FROM tiles WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return json(404, { error: 'Tile not found' });
    return json(200, { ok: true });
  } catch (err) {
    console.error('tiles-admin-delete failed', err);
    return json(500, { error: 'Delete failed' });
  }
};
