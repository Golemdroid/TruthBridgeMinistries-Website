// Monthly request cap, shared by /api/request and /api/config.
// Set MONTHLY_LIMIT in Cloudflare to change it; "0" pauses requests entirely. Months follow UTC.
const DEFAULT_MONTHLY_LIMIT = 20;

export function monthlyLimit(env) {
  const n = parseInt(env.MONTHLY_LIMIT, 10);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_MONTHLY_LIMIT;
}

// First day of next month, e.g. "2026-11-01".
export function reopensOn(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

// Cancelled requests don't count, so volunteers can free a slot by cancelling a duplicate.
export async function capacity(env) {
  const limit = monthlyLimit(env);
  const { n } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM requests WHERE status != 'cancelled' AND created_at >= datetime('now', 'start of month')"
  ).first();
  return { limit, used: n, open: n < limit, reopens: reopensOn() };
}
