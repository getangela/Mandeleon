// Shared helper for the Visitor Accounts functions. Not itself a function —
// Netlify only turns a file into an endpoint if it exports `handler`, and
// this one doesn't, so it's safe to import from any of the sibling files.
const { getDatabase, getConnectionString } = require('@netlify/database');

let db;
function getDb() {
  // Our functions use the classic exports.handler ("Lambda compatibility
  // mode") so that context.clientContext.user works for Identity — but
  // that's also the one case where Netlify doesn't auto-inject the
  // connection string into getDatabase(). This used to read
  // process.env.NETLIFY_DB_URL directly, on the assumption Netlify sets it
  // automatically — confirmed (Sept 9) that it does NOT: Environment
  // variables is completely empty even with a live, migrated production
  // database branch, so that always resolved to undefined and every query
  // failed with a 500. getConnectionString() is @netlify/database's own
  // helper for exactly this situation — it resolves the correct connection
  // string for the current environment/branch without depending on a
  // specific env var being present.
  if (!db) db = getDatabase({ connectionString: getConnectionString() });
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
