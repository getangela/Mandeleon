-- Pending Avatar Claims — closes a real gap in the Visitor Accounts flow
-- (see gamification-spec.md / todo.html): a visitor builds an avatar
-- locally, clicks Sign Up, then confirms their email from a DIFFERENT
-- browser tab or device than the one holding that local avatar. That's
-- common — Safari Private Browsing gives every new tab its own isolated
-- storage as of iOS 17+, and many mail apps open confirmation links in a
-- fresh tab; the same thing happens across two different devices too.
-- Without this table, confirmation still succeeds and logs the visitor in,
-- but the tab/device that completes it has no local avatar to link and the
-- server has none yet either, so the account silently starts blank.
--
-- Netlify Identity gives no server-side signup webhook, and an unconfirmed
-- account has no JWT yet, so our authenticated functions (avatar-save.js,
-- claim-avatar.js) can't be called at signup time. Instead, the frontend's
-- netlifyIdentity.on('signup', ...) handler stashes the local avatar here
-- — a public write, keyed by email, no login required — the moment signup
-- succeeds. avatar-get.js then checks this table by email on that
-- account's first authenticated request (i.e. right after confirmation,
-- from whichever tab/device actually completes it) and adopts the avatar
-- automatically, then deletes the row.
CREATE TABLE IF NOT EXISTS pending_avatar_claims (
  email_lower TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  saved_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
