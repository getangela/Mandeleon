// POST /.netlify/functions/delete-account
// Requires login. Self-service "Delete my account and avatar" — the
// visitor-facing fix for a real gap: until now, the only way to remove
// someone was Aeon manually deleting their login from the Netlify Identity
// dashboard, which never touched their actual data. That left orphaned
// rows behind in every table below, tied to a login that no longer
// existed — which is exactly what made the avatar name "AEON" unusable
// again after a round of test-account cleanup (Sept 2026): the Identity
// user was gone, but its `avatars` row, still holding that name, was not.
//
// Order matters here on purpose: this account's own data is deleted FIRST,
// in one transaction, and only after that succeeds does this function try
// to remove the Identity login itself. If the data deletion fails, nothing
// happens (the transaction rolls back) and the visitor sees an error. If
// the data deletion succeeds but the login removal fails for some reason,
// the worst case is a login with nothing behind it — annoying, but
// harmless, and no worse than today's status quo (it can still be removed
// manually from the Identity dashboard, same as before this feature
// existed). Doing it in the other order — removing the login first — risks
// recreating the exact orphaned-data bug this feature exists to fix if the
// data deletion then failed for any reason.
const { getDb, ensureUser, requireUser, json } = require('./_lib/db');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const user = requireUser(context);
  if (!user) return json(401, { error: 'Not logged in' });

  const db = getDb();
  try {
    await ensureUser(user);

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // Child tables first, regardless of whether FK cascades already
      // handle some of this — explicit deletes here don't depend on that
      // being configured a particular way, and a delete against rows that
      // don't exist is just a no-op, not an error.
      await client.query('DELETE FROM avatars WHERE user_id = $1', [user.sub]);
      await client.query('DELETE FROM saved_tiles WHERE user_id = $1', [user.sub]);
      await client.query('DELETE FROM boards WHERE user_id = $1', [user.sub]); // board_tiles cascade (see boards-manage.js)
      await client.query('DELETE FROM pending_avatar_claims WHERE email_lower = LOWER($1)', [user.email]);
      await client.query('DELETE FROM users WHERE id = $1', [user.sub]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // This account's data is gone at this point no matter what happens
    // below. Removing the Identity login itself is a separate, best-effort
    // step — the classic Netlify Functions + Identity integration (the
    // same one context.clientContext.user relies on elsewhere in this
    // project) exposes an admin-scoped token via
    // context.clientContext.identity for exactly this kind of server-side
    // admin call. This is the one part of this feature that hasn't been
    // exercised against the live site yet — if it turns out this token
    // isn't available in this runtime for some reason, the account's data
    // is still fully deleted; only the login itself would need a manual
    // removal from the Identity dashboard, same one-step process as
    // before this feature existed.
    let loginRemoved = false;
    try {
      const identity = context.clientContext && context.clientContext.identity;
      if (identity && identity.url && identity.token) {
        const res = await fetch(`${identity.url}/admin/users/${user.sub}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${identity.token}` },
        });
        loginRemoved = res.ok;
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          console.error('delete-account: Identity admin delete failed', res.status, detail);
        }
      } else {
        console.error('delete-account: no clientContext.identity admin token available — login was not removed, only data was');
      }
    } catch (err) {
      console.error('delete-account: Identity admin delete threw', err);
    }

    return json(200, { ok: true, loginRemoved });
  } catch (err) {
    console.error('delete-account failed', err);
    return json(500, { error: 'Could not delete your account — try again in a moment.' });
  }
};
