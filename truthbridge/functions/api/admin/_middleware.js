// Protects every /api/admin/* route with the ADMIN_TOKEN secret.
// (For extra protection, also put /admin* behind Cloudflare Access — see README.)
function safeEqual(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  return crypto.subtle.timingSafeEqual(x, y);
}

export async function onRequest({ request, env, next }) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 12) {
    return Response.json({ error: "ADMIN_TOKEN is not configured (needs 12+ characters)." }, { status: 503 });
  }
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !safeEqual(token, env.ADMIN_TOKEN)) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }
  if (!env.DB) return Response.json({ error: "Database (DB) binding missing." }, { status: 503 });
  const res = await next();
  res.headers.set("Cache-Control", "no-store");
  return res;
}
