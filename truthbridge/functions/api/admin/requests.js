// GET   /api/admin/requests?status=new&q=smith   → list requests + counts
// PATCH /api/admin/requests  {ids:[1,2], status:"shipped"} or {id:1, notes:"..."}
const STATUSES = ["new", "packed", "shipped", "cancelled"];

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") || "").trim();

  const where = [];
  const binds = [];
  if (STATUSES.includes(status)) { where.push("status = ?"); binds.push(status); }
  if (q) {
    where.push("(name LIKE ? OR email LIKE ? OR city LIKE ? OR postal LIKE ? OR address1 LIKE ?)");
    const like = `%${q}%`;
    binds.push(like, like, like, like.toUpperCase(), like);
  }
  const sql = `SELECT id, created_at, name, email, phone, address1, address2, city, province, postal,
                      language, heard, message, status, notes, shipped_at, duplicate_of
               FROM requests ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY id DESC LIMIT 500`;
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  const counts = await env.DB.prepare("SELECT status, COUNT(*) AS n FROM requests GROUP BY status").all();

  return Response.json({
    requests: results,
    counts: Object.fromEntries(counts.results.map(r => [r.status, r.n])),
  });
}

export async function onRequestPatch({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map(Number).filter(Number.isInteger);
  if (!ids.length) return Response.json({ error: "No request ids given." }, { status: 400 });

  const stmts = [];
  for (const id of ids) {
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return Response.json({ error: "Invalid status." }, { status: 400 });
      stmts.push(env.DB.prepare(
        `UPDATE requests SET status = ?,
           shipped_at = CASE WHEN ? = 'shipped' THEN COALESCE(shipped_at, datetime('now')) ELSE shipped_at END
         WHERE id = ?`
      ).bind(body.status, body.status, id));
    }
    if (typeof body.notes === "string") {
      stmts.push(env.DB.prepare("UPDATE requests SET notes = ? WHERE id = ?").bind(body.notes.slice(0, 2000), id));
    }
  }
  if (!stmts.length) return Response.json({ error: "Nothing to update." }, { status: 400 });
  await env.DB.batch(stmts);
  return Response.json({ ok: true, updated: ids.length });
}
