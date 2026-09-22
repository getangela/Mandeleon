// GET /.netlify/functions/tiles-admin-list
// GET /.netlify/functions/tiles-admin-list?full=1&offset=0&limit=12
// Admin-only. Two modes:
//
// Default (no `full`): every tile's non-image fields, in one response —
// this is what admin.html's list/search view uses. Deliberately omits
// `img` here: 122 tiles' worth of base64 photos in one response can
// approach the ~6MB payload ceiling Netlify's classic (Lambda-compatible)
// Functions enforce on a single synchronous response, and the list view
// doesn't need full-resolution images anyway.
//
// `full=1` (paginated): the SAME rows, WITH `img` included, a page at a
// time. This is only used by admin.html's "Export index.html" flow, which
// calls this repeatedly (see MAX_LIMIT below — kept well under the payload
// ceiling even at the largest image currently on file) to assemble the
// complete tile set client-side before generating the download. `limit` is
// clamped server-side so a mistaken/huge value from the client can't
// accidentally blow through the payload ceiling itself.
const { getDb, requireAdmin, json } = require('./_lib/db');

const MAX_LIMIT = 20;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const admin = requireAdmin(context);
  if (!admin) return json(403, { error: 'Admin access required' });

  const params = event.queryStringParameters || {};
  const db = getDb();

  try {
    if (params.full) {
      const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.limit) || 12));
      const offset = Math.max(0, Number(params.offset) || 0);
      const rows = await db.sql`
        SELECT id, slug, type, name, cats, icon, color, note, "desc", affiliate, img, link,
               youtube_id AS "youtubeId", no_embed AS "noEmbed", source,
               exotics_linked AS "exoticsLinked", hide_badge AS "hideBadge",
               gadget_meter AS "gadgetMeter", date_added AS "dateAdded"
        FROM tiles
        ORDER BY id ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const totalRows = await db.sql`SELECT COUNT(*)::int AS n FROM tiles`;
      const total = totalRows[0].n;
      return json(200, { tiles: rows, total, offset, limit, hasMore: offset + rows.length < total });
    }

    const rows = await db.sql`
      SELECT id, slug, type, name, cats, icon, color, note, "desc", affiliate, link,
             youtube_id AS "youtubeId", no_embed AS "noEmbed", source,
             exotics_linked AS "exoticsLinked", hide_badge AS "hideBadge",
             gadget_meter AS "gadgetMeter", date_added AS "dateAdded",
             (img IS NOT NULL) AS "hasImg"
      FROM tiles
      ORDER BY id ASC
    `;
    return json(200, { tiles: rows, total: rows.length });
  } catch (err) {
    console.error('tiles-admin-list failed', err);
    return json(500, { error: 'Lookup failed' });
  }
};
