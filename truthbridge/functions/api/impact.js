// GET /api/impact — public totals for the impact dashboard. No personal data leaves the database.
// Bible and shipping costs aren't stored per request yet; set BIBLE_COST and SHIPPING_COST (plain numbers, CAD) in Cloudflare.
const num = v => (v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));

export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ error: "Database not configured." }, { status: 503 });

  const [requested, byProvince, fulfillment] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE status != 'cancelled'"),
    env.DB.prepare("SELECT province, COUNT(*) AS n FROM requests WHERE status = 'shipped' GROUP BY province"),
    env.DB.prepare(
      "SELECT AVG(julianday(shipped_at) - julianday(created_at)) AS days FROM requests WHERE status = 'shipped' AND shipped_at IS NOT NULL"
    ),
  ]);

  const provinces = Object.fromEntries(byProvince.results.map(r => [r.province, r.n]));
  const shipped = byProvince.results.reduce((sum, r) => sum + r.n, 0);
  const days = fulfillment.results[0]?.days;

  return Response.json(
    {
      requested: requested.results[0].n,
      shipped,
      provinces,
      fulfillmentDays: days == null ? null : Math.round(days * 100) / 100,
      bibleCost: num(env.BIBLE_COST),
      shippingCost: num(env.SHIPPING_COST),
    },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
