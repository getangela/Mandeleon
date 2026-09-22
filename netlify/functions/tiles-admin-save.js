// POST /.netlify/functions/tiles-admin-save   body: a tile object
// Admin-only. Create (no `id` in the body) or update (`id` present) a
// single tile — the one write path behind admin.html's Add/Edit form.
//
// Slugs are generated once, on create, and never touched again — see the
// note in database/migrations/004_tiles.sql on why a stable slug matters
// (it's what saved favorites, board memberships, and feed history key
// off). A new name that collides with an existing slug gets a plain
// numbered suffix (-2, -3, …) rather than the old array-index scheme
// index.html used to use — that scheme only ever made sense for a fixed,
// order-dependent array; a real table needs a rule that stays correct no
// matter what gets added, edited, or deleted around it.
const { getDb, requireAdmin, json } = require('./_lib/db');

function slugify(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}

const METER_KEYS = ['sleep', 'energy', 'brain', 'gut', 'heart', 'immune', 'muscle', 'skin'];

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const admin = requireAdmin(context);
  if (!admin) return json(403, { error: 'Admin access required' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const name = String(body.name || '').trim();
  if (!name) return json(400, { error: 'Every tile needs a name' });

  const type = body.type === 'video' ? 'video' : 'product';
  const cats = Array.isArray(body.cats) ? body.cats.map(String).filter(Boolean) : [];
  if (cats.length === 0) return json(400, { error: 'Pick at least one category' });

  if (type === 'video' && !String(body.youtubeId || '').trim()) {
    return json(400, { error: 'Video tiles need a YouTube ID' });
  }

  const gadgetMeter = cats.includes('gadgets') && METER_KEYS.includes(body.gadgetMeter)
    ? body.gadgetMeter
    : null;

  const fields = {
    type,
    name,
    cats: JSON.stringify(cats),
    icon: body.icon || null,
    color: body.color || null,
    note: body.note || null,
    desc: body.desc || null,
    affiliate: typeof body.affiliate === 'boolean' ? body.affiliate : null,
    img: body.img || null,
    link: (body.link || '').trim() || '#',
    youtubeId: type === 'video' ? String(body.youtubeId).trim() : null,
    noEmbed: type === 'video' ? !!body.noEmbed : null,
    source: body.source || null,
    exoticsLinked: !!body.exoticsLinked,
    hideBadge: !!body.hideBadge,
    gadgetMeter,
    dateAdded: body.dateAdded || new Date().toISOString().slice(0, 10),
  };

  const db = getDb();
  try {
    const id = Number(body.id) || null;

    if (id) {
      const existing = await db.sql`SELECT id FROM tiles WHERE id = ${id} LIMIT 1`;
      if (existing.length === 0) return json(404, { error: 'Tile not found' });

      await db.sql`
        UPDATE tiles SET
          type = ${fields.type}, name = ${fields.name}, cats = ${fields.cats}::jsonb,
          icon = ${fields.icon}, color = ${fields.color}, note = ${fields.note},
          "desc" = ${fields.desc}, affiliate = ${fields.affiliate}, img = ${fields.img},
          link = ${fields.link}, youtube_id = ${fields.youtubeId}, no_embed = ${fields.noEmbed},
          source = ${fields.source}, exotics_linked = ${fields.exoticsLinked},
          hide_badge = ${fields.hideBadge}, gadget_meter = ${fields.gadgetMeter},
          date_added = ${fields.dateAdded}, updated_at = NOW()
        WHERE id = ${id}
      `;
      return json(200, { ok: true, id });
    }

    // Create: pick a fresh, stable slug that doesn't collide with any
    // existing one.
    const base = slugify(name) || 'tile';
    let slug = base;
    let n = 2;
    while (true) {
      const clash = await db.sql`SELECT 1 FROM tiles WHERE slug = ${slug} LIMIT 1`;
      if (clash.length === 0) break;
      slug = `${base}-${n}`;
      n++;
    }

    const rows = await db.sql`
      INSERT INTO tiles
        (slug, type, name, cats, icon, color, note, "desc", affiliate, img, link,
         youtube_id, no_embed, source, exotics_linked, hide_badge, gadget_meter, date_added)
      VALUES
        (${slug}, ${fields.type}, ${fields.name}, ${fields.cats}::jsonb, ${fields.icon},
         ${fields.color}, ${fields.note}, ${fields.desc}, ${fields.affiliate}, ${fields.img},
         ${fields.link}, ${fields.youtubeId}, ${fields.noEmbed}, ${fields.source},
         ${fields.exoticsLinked}, ${fields.hideBadge}, ${fields.gadgetMeter}, ${fields.dateAdded})
      RETURNING id, slug
    `;
    return json(200, { ok: true, id: rows[0].id, slug: rows[0].slug });
  } catch (err) {
    console.error('tiles-admin-save failed', err);
    return json(500, { error: 'Save failed' });
  }
};
