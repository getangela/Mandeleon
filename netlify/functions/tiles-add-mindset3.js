// GET /.netlify/functions/tiles-add-mindset3
// Admin-only, ONE-TIME USE. Adds the 3 new Mindset (inspiration) quote
// tiles — cleaned-up/recolored versions of 3 images sent by the site owner
// in Oct 2026 — straight into the `tiles` table, the same way any tile
// added from admin.html's "Add Tile" form would be. See
// _lib/tiles-add-mindset3-data.json for the actual tile data.
//
// This is NOT the same shape as tiles-import.js: that one refuses to run
// at all once the table has ANY rows (it was a once-ever full migration).
// This one is scoped per-slug instead — it only skips a tile whose slug
// already exists, so if it's ever run twice (or the page visited again by
// mistake) nothing gets duplicated, but it still isn't a all-or-nothing
// gate tied to the table being empty. Safe to delete this file from
// netlify/functions once admin.html confirms the 3 tiles are in (138
// total), same as the note on tiles-import.js.
const { getDb, requireAdmin, json } = require('./_lib/db');
const TILES = require('./_lib/tiles-add-mindset3-data.json');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const admin = requireAdmin(context);
  if (!admin) return json(403, { error: 'Admin access required' });

  const db = getDb();
  try {
    let inserted = 0;
    let skipped = 0;
    const results = [];

    for (const t of TILES) {
      const existing = await db.sql`SELECT id FROM tiles WHERE slug = ${t.slug} LIMIT 1`;
      if (existing.length > 0) {
        skipped++;
        results.push({ slug: t.slug, status: 'already exists', id: existing[0].id });
        continue;
      }

      const rows = await db.sql`
        INSERT INTO tiles
          (slug, type, name, cats, icon, color, note, "desc", affiliate, img, link,
           youtube_id, no_embed, source, exotics_linked, hide_badge, gadget_meter, date_added)
        VALUES
          (${t.slug}, ${t.type}, ${t.name}, ${JSON.stringify(t.cats)}::jsonb, ${t.icon},
           ${t.color}, ${t.note}, ${t.desc}, ${t.affiliate}, ${t.img}, ${t.link},
           ${t.youtubeId}, ${t.noEmbed}, ${t.source}, ${t.exoticsLinked}, ${t.hideBadge},
           ${t.gadgetMeter}, ${t.dateAdded})
        RETURNING id, slug
      `;
      inserted++;
      results.push({ slug: rows[0].slug, status: 'inserted', id: rows[0].id });
    }

    return json(200, { ok: true, inserted, skipped, results });
  } catch (err) {
    console.error('tiles-add-mindset3 failed', err);
    return json(500, { error: 'Insert failed — check the Netlify function logs for details.' });
  }
};
