// GET /.netlify/functions/avatar-get
// Requires login. Returns the account's avatar (the full JSONB blob, same
// shape as the localStorage object), or { avatar: null } if this account
// hasn't claimed/created one yet — the frontend uses that to decide whether
// to offer the "import your existing avatar" prompt.
const { getDb, ensureUser, requireUser, json } = require('./_lib/db');

// If nothing's on the account yet, check whether an avatar was stashed here
// before this visitor confirmed their email (see the pending_avatar_claims
// migration + stash-pending-avatar.js) — this is what lets a visitor build
// an avatar, sign up, and confirm from a totally different browser tab or
// device without losing it. Only adopts claims from the last 7 days so a
// years-old abandoned row can't surface unexpectedly.
async function adoptPendingClaim(db, user) {
  const pending = await db.sql`
    SELECT data, saved_slugs FROM pending_avatar_claims
    WHERE email_lower = LOWER(${user.email}) AND created_at > NOW() - INTERVAL '7 days'
    LIMIT 1
  `;
  if (pending.length === 0) return null;

  const avatar = pending[0].data;
  const savedSlugs = Array.isArray(pending[0].saved_slugs) ? pending[0].saved_slugs : [];
  const name = (avatar && avatar.name || '').trim().slice(0, 30);
  if (!name) return null;

  const clash = await db.sql`SELECT 1 FROM avatars WHERE name_lower = LOWER(${name}) LIMIT 1`;
  if (clash.length > 0) {
    // Someone else already has that name — leave the pending row in place
    // (nothing better to do automatically) and fall back to the normal
    // "nothing yet" experience; the visitor can still rename and use the
    // manual claim flow.
    return null;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO avatars (user_id, name, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (user_id) DO NOTHING',
      [user.sub, name, JSON.stringify(avatar)]
    );
    for (const slug of savedSlugs) {
      await client.query(
        'INSERT INTO saved_tiles (user_id, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.sub, String(slug)]
      );
    }
    await client.query('DELETE FROM pending_avatar_claims WHERE email_lower = LOWER($1)', [user.email]);
    await client.query('COMMIT');
    return avatar;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('pending avatar adoption failed', err);
    return null;
  } finally {
    client.release();
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const user = requireUser(context);
  if (!user) return json(401, { error: 'Not logged in' });

  try {
    await ensureUser(user);
    const db = getDb();
    const rows = await db.sql`
      SELECT name, data, updated_at FROM avatars WHERE user_id = ${user.sub} LIMIT 1
    `;
    if (rows.length > 0) return json(200, { avatar: rows[0].data, updatedAt: rows[0].updated_at });

    const adopted = await adoptPendingClaim(db, user);
    if (adopted) return json(200, { avatar: adopted, updatedAt: new Date().toISOString() });

    return json(200, { avatar: null });
  } catch (err) {
    console.error('avatar-get failed', err);
    return json(500, { error: 'Lookup failed' });
  }
};
