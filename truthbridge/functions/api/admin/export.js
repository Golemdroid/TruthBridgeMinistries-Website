// GET /api/admin/export?status=new → CSV for mailing labels / Canada Post bulk upload
const STATUSES = ["new", "packed", "shipped", "cancelled"];
const COLS = ["id", "created_at", "name", "address1", "address2", "city", "province", "postal",
              "language", "email", "phone", "status", "shipped_at", "duplicate_of", "notes"];

const cell = v => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function onRequestGet({ request, env }) {
  const status = new URL(request.url).searchParams.get("status");
  const filter = STATUSES.includes(status);
  const stmt = env.DB.prepare(
    `SELECT ${COLS.join(", ")} FROM requests ${filter ? "WHERE status = ?" : ""} ORDER BY id`
  );
  const { results } = await (filter ? stmt.bind(status) : stmt).all();
  const csv = [COLS.join(","), ...results.map(r => COLS.map(c => cell(r[c])).join(","))].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bible-requests-${status || "all"}-${date}.csv"`,
    },
  });
}
