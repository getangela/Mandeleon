// GET /.netlify/functions/tiles-admin-get?id=123
// Admin-only. One tile, every field including its full image — used when
// admin.html opens a tile in the edit form. A single tile's image (the
// largest currently on file is ~300KB) is nowhere near the payload ceiling
// that makes tiles-admin-list omit images for the full tile set, so no
// pagination is needed here.
const { getDb, requireAdmin, json } = require('./_lib/db');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const admin = requireAdmin(context);
  if (!admin) return json(403, { error: 'Admin access required' });

  const id = Number((event.queryStringParameters || {}).id);
  if (!id) return json(400, { error: 'Missing id' });

  try {
    const db = getDb();
    const rows = await db.sql`
      SELECT id, slug, type, name, cats, icon, color, note, "desc", affiliate, img, link,
             youtube_id AS "youtubeId", no_embed AS "noEmbed", source,
             exotics_linked AS "exoticsLinked", hide_badge AS "hideBadge",
             gadget_meter AS "gadgetMeter", date_added AS "dateAdded"
      FROM tiles WHERE id = ${id} LIMIT 1
    `;
    if (rows.length === 0) return json(404, { error: 'Tile not found' });
    return json(200, { tile: rows[0] });
  } catch (err) {
    console.error('tiles-admin-get failed', err);
    return json(500, { error: 'Lookup failed' });
  }
};
