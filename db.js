// Shared helper for the Visitor Accounts functions. Not itself a function —
// Netlify only turns a file into an endpoint if it exports `handler`, and
// this one doesn't, so it's safe to import from any of the sibling files.
const { getDatabase } = require('@netlify/database');

let db;
function getDb() {
  if (!db) db = getDatabase();
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
