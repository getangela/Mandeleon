// POST /.netlify/functions/stash-pending-avatar   body: { email, avatar, savedSlugs }
// Public — no login required. This runs the moment the Identity widget's
// own 'signup' event fires, which is BEFORE email confirmation — there's no
// JWT yet at that point, so the authenticated functions (avatar-save.js,
// claim-avatar.js) can't be used. See the pending_avatar_claims migration
// for the full story: this is what lets a visitor who confirms their email
// from a different browser tab or device than the one holding their local
// avatar (very common — Safari Private Browsing isolates storage per tab as
// of iOS 17+, and many mail apps open links in a fresh tab) get it back
// automatically instead of silently starting over. avatar-get.js reads this
// table on that account's first authenticated request and adopts + deletes
// the row from there.
//
// Being unauthenticated, this endpoint is intentionally narrow: the worst
// an abusive call can do is squat a pending row under an email address that
// isn't the caller's, so that if the real owner signs up before it expires
// they'd inherit unwanted data instead of nothing — annoying, not
// dangerous (adoption in avatar-get.js still enforces the same global
// avatar-name uniqueness every other write does, and the visitor can always
// just rename/recreate). The size cap and the 7-day freshness window that
// avatar-get.js applies when reading keep that window small.
const { getDb, json } = require('./_lib/db');

const MAX_PAYLOAD_CHARS = 3_000_000; // generous — a profile photo dataURL is the biggest thing in here
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const email = String(payload.email || '').trim().toLowerCase();
  const avatar = payload.avatar;
  const savedSlugs = Array.isArray(payload.savedSlugs) ? payload.savedSlugs.map(String).slice(0, 500) : [];
  const name = (avatar && avatar.name || '').trim().slice(0, 30);

  if (!EMAIL_RE.test(email)) return json(400, { error: 'Invalid email' });
  if (!avatar || !name) return json(400, { error: 'Missing avatar to stash' });

  const serialized = JSON.stringify(avatar);
  if (serialized.length > MAX_PAYLOAD_CHARS) return json(413, { error: 'Avatar payload too large' });

  try {
    const db = getDb();
    await db.sql`
      INSERT INTO pending_avatar_claims (email_lower, data, saved_slugs, created_at)
      VALUES (${email}, ${serialized}::jsonb, ${JSON.stringify(savedSlugs)}::jsonb, NOW())
      ON CONFLICT (email_lower) DO UPDATE
        SET data = EXCLUDED.data, saved_slugs = EXCLUDED.saved_slugs, created_at = NOW()
    `;
    return json(200, { ok: true });
  } catch (err) {
    console.error('stash-pending-avatar failed', err);
    return json(500, { error: 'Stash failed' });
  }
};
