// GET /.netlify/functions/avatar-get
// Requires login. Returns the account's avatar (the full JSONB blob, same
// shape as the localStorage object), or { avatar: null } if this account
// hasn't claimed/created one yet — the frontend uses that to decide whether
// to offer the "import your existing avatar" prompt.
const { getDb, ensureUser, requireUser, json } = require('./_lib/db');

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
    if (rows.length === 0) return json(200, { avatar: null });
    return json(200, { avatar: rows[0].data, updatedAt: rows[0].updated_at });
  } catch (err) {
    console.error('avatar-get failed', err);
    return json(500, { error: 'Lookup failed' });
  }
};
