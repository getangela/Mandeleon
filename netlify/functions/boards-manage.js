// POST /.netlify/functions/boards-manage   body: { action, ... }
// Requires login. Single endpoint for every Personal Boards write —
// create/rename/delete a board, or add/remove a tile from one — keeping
// this to two files total alongside boards-list.js rather than one file
// per action, matching the "a few clearly-named functions" scale the rest
// of netlify/functions/ already uses. Every action re-checks the board
// belongs to the calling account before touching it, since board ids are
// plain sequential integers (not per-user-scoped in the id itself).
const { getDb, ensureUser, requireUser, json } = require('./_lib/db');

const MAX_NAME_LENGTH = 40;

async function ownsBoard(db, userId, boardId) {
  const rows = await db.sql`SELECT 1 FROM boards WHERE id = ${boardId} AND user_id = ${userId} LIMIT 1`;
  return rows.length > 0;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const user = requireUser(context);
  if (!user) return json(401, { error: 'Not logged in' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const db = getDb();
  try {
    await ensureUser(user);

    switch (payload.action) {
      case 'create': {
        const name = String(payload.name || '').trim().slice(0, MAX_NAME_LENGTH);
        if (!name) return json(400, { error: 'Board needs a name' });
        const clash = await db.sql`
          SELECT 1 FROM boards WHERE user_id = ${user.sub} AND name_lower = LOWER(${name}) LIMIT 1
        `;
        if (clash.length > 0) return json(409, { error: 'You already have a board with that name' });
        const rows = await db.sql`
          INSERT INTO boards (user_id, name) VALUES (${user.sub}, ${name}) RETURNING id, name
        `;
        return json(200, { ok: true, board: { id: rows[0].id, name: rows[0].name, slugs: [] } });
      }

      case 'rename': {
        const id = Number(payload.id);
        const name = String(payload.name || '').trim().slice(0, MAX_NAME_LENGTH);
        if (!id || !name) return json(400, { error: 'Missing board id or name' });
        if (!(await ownsBoard(db, user.sub, id))) return json(404, { error: 'Board not found' });
        const clash = await db.sql`
          SELECT 1 FROM boards WHERE user_id = ${user.sub} AND name_lower = LOWER(${name}) AND id != ${id} LIMIT 1
        `;
        if (clash.length > 0) return json(409, { error: 'You already have a board with that name' });
        await db.sql`UPDATE boards SET name = ${name} WHERE id = ${id}`;
        return json(200, { ok: true });
      }

      case 'delete': {
        const id = Number(payload.id);
        if (!id) return json(400, { error: 'Missing board id' });
        if (!(await ownsBoard(db, user.sub, id))) return json(404, { error: 'Board not found' });
        await db.sql`DELETE FROM boards WHERE id = ${id}`; // board_tiles rows cascade
        return json(200, { ok: true });
      }

      case 'addTile': {
        const id = Number(payload.id);
        const slug = String(payload.slug || '');
        if (!id || !slug) return json(400, { error: 'Missing board id or slug' });
        if (!(await ownsBoard(db, user.sub, id))) return json(404, { error: 'Board not found' });
        await db.sql`
          INSERT INTO board_tiles (board_id, slug) VALUES (${id}, ${slug}) ON CONFLICT DO NOTHING
        `;
        return json(200, { ok: true });
      }

      case 'removeTile': {
        const id = Number(payload.id);
        const slug = String(payload.slug || '');
        if (!id || !slug) return json(400, { error: 'Missing board id or slug' });
        if (!(await ownsBoard(db, user.sub, id))) return json(404, { error: 'Board not found' });
        await db.sql`DELETE FROM board_tiles WHERE board_id = ${id} AND slug = ${slug}`;
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: 'Unknown action' });
    }
  } catch (err) {
    console.error('boards-manage failed', err);
    return json(500, { error: 'Request failed' });
  }
};
