// POST /.netlify/functions/avatar-save   body: the avatar object (see
// createAvatar() in index.html for its shape)
// Requires login. This is the background sync target — every time the
// logged-in visitor's local avatar object changes (feeding, decay, photo,
// etc.), index.html fire-and-forgets a copy here so it's never more than
// one save behind across devices. Enforces the same global name-uniqueness
// rule the claim flow does.
const { getDb, ensureUser, requireUser, json } = require('./_lib/db');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const user = requireUser(context);
  if (!user) return json(401, { error: 'Not logged in' });

  let avatar;
  try {
    avatar = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }
  const name = (avatar && avatar.name || '').trim().slice(0, 30);
  if (!name) return json(400, { error: 'Avatar needs a name' });

  try {
    await ensureUser(user);
    const db = getDb();

    const clash = await db.sql`
      SELECT 1 FROM avatars
      WHERE name_lower = LOWER(${name}) AND user_id != ${user.sub}
      LIMIT 1
    `;
    if (clash.length > 0) {
      return json(409, { error: 'That avatar name is already taken. Try another.' });
    }

    await db.sql`
      INSERT INTO avatars (user_id, name, data, updated_at)
      VALUES (${user.sub}, ${name}, ${JSON.stringify(avatar)}::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = NOW()
    `;
    return json(200, { ok: true });
  } catch (err) {
    console.error('avatar-save failed', err);
    return json(500, { error: 'Save failed' });
  }
};
