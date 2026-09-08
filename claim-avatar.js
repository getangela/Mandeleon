// POST /.netlify/functions/claim-avatar   body: { avatar, savedSlugs }
// Requires login. One-time action offered right after a first login when
// the visitor already has a localStorage-only avatar and this account
// doesn't have one in the database yet (index.html checks avatar-get first
// and only offers this as an *optional* prompt — see gamification-spec.md /
// todo.html "Visitor Accounts"). Refuses to run if the account already has
// an avatar, so it can't accidentally clobber one by being called twice.
const { getDb, ensureUser, requireUser, json } = require('./_lib/db');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const user = requireUser(context);
  if (!user) return json(401, { error: 'Not logged in' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }
  const avatar = payload.avatar;
  const savedSlugs = Array.isArray(payload.savedSlugs) ? payload.savedSlugs : [];
  const name = (avatar && avatar.name || '').trim().slice(0, 30);
  if (!avatar || !name) return json(400, { error: 'Missing avatar to claim' });

  const db = getDb();
  try {
    await ensureUser(user);

    const existing = await db.sql`SELECT 1 FROM avatars WHERE user_id = ${user.sub} LIMIT 1`;
    if (existing.length > 0) {
      return json(409, { error: 'This account already has an avatar.' });
    }
    const clash = await db.sql`
      SELECT 1 FROM avatars WHERE name_lower = LOWER(${name}) LIMIT 1
    `;
    if (clash.length > 0) {
      return json(409, { error: 'That avatar name is already taken. Rename it on this device, then try again.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO avatars (user_id, name, data) VALUES ($1, $2, $3::jsonb)',
        [user.sub, name, JSON.stringify(avatar)]
      );
      for (const slug of savedSlugs) {
        await client.query(
          'INSERT INTO saved_tiles (user_id, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user.sub, String(slug)]
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
  } catch (err) {
    console.error('claim-avatar failed', err);
    return json(500, { error: 'Claim failed' });
  }
};
