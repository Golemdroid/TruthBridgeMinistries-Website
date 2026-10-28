// Public, non-secret settings the front end needs, including whether requests are open this month.
import { capacity } from "../../lib/capacity.js";

export async function onRequestGet({ env }) {
  const cap = env.DB ? await capacity(env).catch(() => null) : null;
  return Response.json(
    {
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
      requests: cap && { open: cap.open, limit: cap.limit, remaining: Math.max(0, cap.limit - cap.used), reopens: cap.reopens },
    },
    { headers: { "Cache-Control": "public, max-age=30" } }
  );
}
