// Shared helper for the Visitor Accounts functions. Not itself a function —
// Netlify only turns a file into an endpoint if it exports `handler`, and
// this one doesn't, so it's safe to import from any of the sibling files.
const { getDatabase } = require('@netlify/database');

let db;
function getDb() {
  // Our functions use the classic exports.handler ("Lambda compatibility
  // mode") so that context.clientContext.user works for Identity — but
  // that's also the one case where Netlify doesn't auto-inject the
  // connection string into getDatabase(). NETLIFY_DB_URL is still set on
  // process.env automatically; it just has to be passed in explicitly here.
  if (!db) db = getDatabase({ connectionString: process.env.NETLIFY_DB_URL });
  return db;
}

// Every authenticated function calls this first. It's the only place a
// `users` row gets created — there's no separate Identity signup webhook,
// so we just lazily upsert on first authenticated request instead.
async function ensureUser(identityUser) {
  const db = getDb();
  const id = identityUser.sub;
  const email = identityUser.email;
  await db.sql`
    INSERT INTO users (id, email) VALUES (${id}, ${email})
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
  `;
  return id;
}

// Pulled out of every handler so the "not logged in" response is identical
// everywhere. Classic Netlify Identity + Functions integration: the
// platform decodes the Authorization: Bearer <jwt> header itself and hands
// the result here — nothing extra to install or configure for this part.
function requireUser(context) {
  const user = context.clientContext && context.clientContext.user;
  if (!user || !user.sub) return null;
  return user;
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

module.exports = { getDb, ensureUser, requireUser, json };

File 2 — netlify/functions/avatar-name-check.js (just removes the temporary debug output now that we know the real cause):

Read a file
js
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
    return json(500, { error: 'Lookup failed' });
  }
};
