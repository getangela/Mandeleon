// GET /.netlify/functions/tiles-import
// Admin-only, ONE-TIME USE. Seeds the new `tiles` table (see
// database/migrations/004_tiles.sql) from every product/video tile that
// was already live in index.html's PRODUCTS array as of the Admin
// Dashboard build (Sept 2026) — see tiles-seed-data.json, generated once
// and frozen at that point, including each tile's slug computed to match
// exactly what the live site's own runtime slugify() already produces for
// it, so nobody's saved favorites, board memberships, or feed history
// (all keyed by slug) break when tiles move from the hardcoded array into
// this table.
//
// Idempotent on purpose: refuses to run if the table already has ANY rows,
// so visiting this URL twice (or a hundred times) can't ever double-import
// or clobber tiles you've since added/edited/deleted from admin.html. Once
// you've confirmed the import worked (see admin.html's tile count), this
// file has done its one job — safe to delete it from netlify/functions,
// though leaving it in place is harmless too since it'll just keep
// refusing to do anything.
const { getDb, requireAdmin, json } = require('./_lib/db');
const SEED = require('./_lib/tiles-seed-data.json');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const admin = requireAdmin(context);
  if (!admin) return json(403, { error: 'Admin access required' });

  const db = getDb();
  try {
    const existing = await db.sql`SELECT COUNT(*)::int AS n FROM tiles`;
    if (existing[0].n > 0) {
      return json(409, {
        error: `tiles already has ${existing[0].n} row(s) — refusing to import again. Delete this function or ignore it; nothing was changed.`,
      });
    }

    const client = await db.pool.connect();
    let inserted = 0;
    try {
      await client.query('BEGIN');
      for (const t of SEED) {
        await client.query(
          `INSERT INTO tiles
             (slug, type, name, cats, icon, color, note, "desc", affiliate, img, link,
              youtube_id, no_embed, source, exotics_linked, hide_badge, gadget_meter, date_added)
           VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            t.slug, t.type, t.name, JSON.stringify(t.cats), t.icon, t.color, t.note, t.desc,
            t.affiliate, t.img, t.link, t.youtubeId, t.noEmbed, t.source, t.exoticsLinked,
            t.hideBadge, t.gadgetMeter, t.dateAdded,
          ]
        );
        inserted++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return json(200, { ok: true, imported: inserted });
  } catch (err) {
    console.error('tiles-import failed', err);
    return json(500, { error: 'Import failed — check the Netlify function logs for details.' });
  }
};
