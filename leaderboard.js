// GET /.netlify/functions/leaderboard
// Public — no login required. Anyone can see rankings, same as the rest of
// the site being browsable without an account; only visitors who've signed
// up and synced an avatar (see avatar-save.js) show up in it at all. If the
// request IS authenticated (the same context.clientContext.user Netlify
// Identity + Functions decodes for every other endpoint here), the response
// also includes that visitor's own rank/row even when it falls outside the
// top slice, so "where do I stand" doesn't require scrolling past everyone
// ahead of them.
//
// Ranked by careScore (Longevity Score) — the one permanent, only-goes-up
// stat already built for leveling (see getAvatarLevel() in index.html), NOT
// the day-to-day meter average/Class, which resets with neglect and would
// make the board reshuffle on every decay tick instead of rewarding
// sustained care. Returns name + careScore + meters + inComa + createdAt
// per avatar — enough for the frontend to compute the exact same Health/
// Class pills an avatar's own panel shows, via the same getAvatarPool()/
// getAvatarVitalityTier() functions, so the two displays can never drift
// apart.
//
// Deliberately never returns faceImage. todo.html flags avatar-photo
// moderation as an open gap for exactly the moment avatars become visible
// to OTHER visitors (not just synced across one visitor's own devices) —
// this endpoint is that moment, so photos stay out of the public response
// until that moderation structure exists.
//
// Pulls every avatar row and ranks in JS rather than a SQL window function —
// the simplest correct thing at this site's current scale (a personal
// project's leaderboard, not a table with millions of rows). Revisit with a
// proper indexed/paginated query if that ever changes.
const { getDb, requireUser, json } = require('./_lib/db');

const TOP_N = 50;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const db = getDb();
    const rows = await db.sql`SELECT user_id, name, data, updated_at FROM avatars`;

    const ranked = rows
      .map(row => {
        const data = row.data || {};
        return {
          userId: row.user_id,
          name: row.name,
          careScore: Number(data.careScore) || 0,
          meters: data.meters || {},
          inComa: !!data.inComa,
          createdAt: data.createdAt || null,
          updatedAt: row.updated_at,
        };
      })
      // Ties broken by whoever reached that score first (earlier
      // updated_at), not whoever most recently touched their avatar — so
      // the board rewards standing, not just being the last one active.
      .sort((a, b) => b.careScore - a.careScore || new Date(a.updatedAt) - new Date(b.updatedAt))
      .map((entry, i) => Object.assign(entry, { rank: i + 1 }));

    const trim = (entry) => ({
      rank: entry.rank,
      name: entry.name,
      careScore: entry.careScore,
      meters: entry.meters,
      inComa: entry.inComa,
      createdAt: entry.createdAt,
    });

    const top = ranked.slice(0, TOP_N).map(trim);

    const user = requireUser(context);
    let me = null;
    if (user) {
      const mine = ranked.find(entry => entry.userId === user.sub);
      if (mine) me = trim(mine);
    }

    return json(200, { total: ranked.length, top, me });
  } catch (err) {
    console.error('leaderboard failed', err);
    return json(500, { error: 'Leaderboard lookup failed' });
  }
};
