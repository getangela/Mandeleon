// Shared helper for the Visitor Accounts functions. Not itself a function —
// Netlify only turns a file into an endpoint if it exports `handler`, and
// this one doesn't, so it's safe to import from any of the sibling files.
const { getDatabase } = require('@netlify/database');

let db;
function getDb() {
  // Our functions use the classic exports.handler ("Lambda compatibility
  // mode") so that context.clientContext.user works for Identity — and per
  // Netlify's own docs, this is the ONE case where nothing is auto-injected
  // at all: not process.env.NETLIFY_DB_URL (confirmed empty), and not
  // getConnectionString() either (confirmed Sept 9 — it throws
  // MissingDatabaseConnectionError in this exact function format, live
  // stack trace and all). Classic handler-mode functions are documented as
  // "responsible for passing the connection string yourself." So:
  // DATABASE_URL is a real environment variable we set manually, containing
  // the actual copied connection string for the production database branch
  // from the Netlify DB dashboard — not something Netlify names or sets on
  // its own.
  if (!db) db = getDatabase({ connectionString: process.env.DATABASE_URL });
  return db;
}

// Every authenticated function calls this first. It's the only place a
// `users` row gets created — there's no separate Identity signup webhook,
// so we just lazily upsert on first authenticated request instead.
async function ensureUser(identityUser) {
  const db = getDb();
  const id = identityUser.sub;
  const email = identityUser.email;
  // A visitor can end up logging in with a different Identity `sub` (id)
  // for the same email — e.g. their old Identity account was deleted and
  // a new one created with that same address. email is UNIQUE on this
  // table, so that leaves a stale row sitting under the old id, and
  // `ON CONFLICT (id)` below can't see it (the collision is on the email
  // constraint, not the id one) — confirmed live Sept 9, claim-avatar
  // failing with "duplicate key value violates unique constraint
  // users_email_key" even though this exact insert had never run for this
  // id before. Clear out any such stale row first; ON DELETE CASCADE on
  // avatars/saved_tiles takes any leftover data for that dead account
  // with it, since it's no longer reachable under the old id anyway.
  await db.sql`DELETE FROM users WHERE email = ${email} AND id != ${id}`;
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
