// GET /.netlify/functions/avatar-name-check?name=Whatever
// Public — no login required. Used both while a guest is naming a
// brand-new avatar (best-effort heads-up, not enforced) and, more
// importantly, as the real-time check on the account-linked flows
// (claim-avatar / avatar-save), which enforce it server-side regardless.
const { getDb, json } = require('./_lib/db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const name = (event.queryStringParameters && event.queryStringParameters.name || '').trim();
  if (!name) return json(400, { error: 'Missing name' });

  try {
    const db = getDb();
    const rows = await db.sql`
      SELECT 1 FROM avatars WHERE name_lower = LOWER(${name}) LIMIT 1
    `;
    return json(200, { available: rows.length === 0 });
  } catch (err) {
    console.error('avatar-name-check failed', err);
    // TEMPORARY diagnostic — surfaces the real error so we can see what's
    // actually failing without needing Netlify dashboard log access. Will
    // be reverted to a generic message once the root cause is confirmed.
    return json(500, { error: 'Lookup failed', debug: String(err && err.message || err), stack: err && err.stack });
  }
};
