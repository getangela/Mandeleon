// GET  /.netlify/functions/tiles-sync   -> { slugs: [...] }
// POST /.netlify/functions/tiles-sync   body: { slugs: [...] } -> replaces
//      the account's full saved-tiles set with exactly this list
// Requires login. Mirrors the existing localStorage "saved" Set (the
// favorites board) for a logged-in account, the same replace-the-whole-set
// way SAVED_SLUGS_KEY already works locally — simplest way to keep the two
// in sync without a per-tile diff.
const { getDb, ensureUser, requireUser, json } = require('./_lib/db');

exports.handler = async (event, context) => {
  const user = requireUser(context);
  if (!user) return json(401, { error: 'Not logged in' });

  const db = getDb();
  try {
    await ensureUser(user);

    if (event.httpMethod === 'GET') {
      const rows = await db.sql`SELECT slug FROM saved_tiles WHERE user_id = ${user.sub}`;
      return json(200, { slugs: rows.map(r => r.slug) });
    }

    if (event.httpMethod === 'POST') {
      let payload;
      try {
        payload = JSON.parse(event.body || '{}');
      } catch (err) {
        return json(400, { error: 'Invalid JSON body' });
      }
      const slugs = Array.isArray(payload.slugs) ? payload.slugs.map(String) : [];

      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM saved_tiles WHERE user_id = $1', [user.sub]);
        for (const slug of slugs) {
          await client.query(
            'INSERT INTO saved_tiles (user_id, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [user.sub, slug]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('tiles-sync failed', err);
    return json(500, { error: 'Sync failed' });
  }
};
