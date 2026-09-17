// POST /.netlify/functions/claim-pending-avatar   body: { name }
// Requires login. Rescues a pending cross-device avatar claim (see
// pending_avatar_claims + adoptPendingClaim() in avatar-get.js) whose
// automatic adoption was blocked because its avatar name collided with a
// different account's avatar — avatar-get.js's response for that case
// includes claimBlocked:'name_taken' and the blocked name, and the
// frontend's rename banner (see setupAvatarRenameBanner() in index.html)
// posts here with a new name to retry.
//
// This lets the visitor rescue their avatar from whichever device they're
// confirming their email on, without needing to go back to the device that
// originally created it — the avatar data itself already lives in
// pending_avatar_claims, keyed by email, so all this does is rename it in
// place and re-run the same adopt-and-delete-the-pending-row logic
// adoptPendingClaim() does on a successful (non-colliding) adoption.
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
  const newName = String(payload.name || '').trim().slice(0, 30);
  if (!newName) return json(400, { error: 'Enter a name.' });

  const db = getDb();
  try {
    await ensureUser(user);

    // Same guard claim-avatar.js uses — if this account already picked up
    // an avatar some other way in the meantime (another tab, a retry that
    // already succeeded), there's nothing to rescue and nothing should be
    // overwritten.
    const existing = await db.sql`SELECT 1 FROM avatars WHERE user_id = ${user.sub} LIMIT 1`;
    if (existing.length > 0) {
      return json(409, { error: 'This account already has an avatar.' });
    }

    const pending = await db.sql`
      SELECT data, saved_slugs FROM pending_avatar_claims
      WHERE email_lower = LOWER(${user.email}) AND created_at > NOW() - INTERVAL '7 days'
      LIMIT 1
    `;
    if (pending.length === 0) {
      return json(404, { error: "Nothing pending to rescue — it may have expired. Try creating a new avatar instead." });
    }

    const clash = await db.sql`SELECT 1 FROM avatars WHERE name_lower = LOWER(${newName}) LIMIT 1`;
    if (clash.length > 0) {
      return json(409, { error: 'That name is taken too. Try another.' });
    }

    const avatar = Object.assign({}, pending[0].data, { name: newName });
    const savedSlugs = Array.isArray(pending[0].saved_slugs) ? pending[0].saved_slugs : [];

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO avatars (user_id, name, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (user_id) DO NOTHING',
        [user.sub, newName, JSON.stringify(avatar)]
      );
      for (const slug of savedSlugs) {
        await client.query(
          'INSERT INTO saved_tiles (user_id, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user.sub, String(slug)]
        );
      }
      await client.query('DELETE FROM pending_avatar_claims WHERE email_lower = LOWER($1)', [user.email]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return json(200, { ok: true, avatar });
  } catch (err) {
    console.error('claim-pending-avatar failed', err);
    return json(500, { error: 'Rescue failed' });
  }
};
