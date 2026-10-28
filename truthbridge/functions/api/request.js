// POST /api/request — saves a free Bible request.
import { capacity } from "../../lib/capacity.js";

const PROVINCES = new Set(["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"]);
const POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PER_IP_PER_DAY = 5;

const err = (error, status = 400) => Response.json({ error }, { status });
const clean = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(token, ip, secret) {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token || "");
  if (ip) body.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const out = await r.json().catch(() => ({}));
  return out.success === true;
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return err("The request system isn't configured yet. Please try again later.", 503);

  let data;
  try {
    const ct = request.headers.get("content-type") || "";
    data = ct.includes("application/json") ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return err("We couldn't read your request. Please try again.");
  }

  // Honeypot: bots fill hidden fields. Pretend success.
  if (data.website) return Response.json({ ok: true });

  // Monthly cap — checked before anything else touches the database.
  const cap = await capacity(env);
  if (!cap.open) {
    return Response.json(
      { error: "This month's free Bible requests are full. Please try again next month.", full: true, reopens: cap.reopens },
      { status: 429 }
    );
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";

  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(data["cf-turnstile-response"], ip, env.TURNSTILE_SECRET);
    if (!ok) return err("Please complete the verification check and try again.");
  }

  const r = {
    name: clean(data.name, 120),
    email: clean(data.email, 200).toLowerCase(),
    phone: clean(data.phone, 30),
    address1: clean(data.address1, 200),
    address2: clean(data.address2, 200),
    city: clean(data.city, 100),
    province: clean(data.province, 2).toUpperCase(),
    postal: clean(data.postal, 7).toUpperCase().replace(/\s/g, ""),
    language: "English", // only English Bibles are sent
    heard: clean(data.heard, 200),
    message: typeof data.message === "string" ? data.message.trim().slice(0, 2000) : "",
  };

  if (!r.name || !r.address1 || !r.city) return err("Please fill in your name and full mailing address.");
  if (!PROVINCES.has(r.province)) return err("Please choose your province or territory.");
  if (!POSTAL.test(r.postal)) return err("Please enter a valid Canadian postal code.");
  if (r.email && !EMAIL.test(r.email)) return err("That email address doesn't look right.");
  if (data.consent !== true && data.consent !== "on" && data.consent !== "true") {
    return err("Please agree to the privacy policy so we can mail your Bible.");
  }
  r.postal = `${r.postal.slice(0, 3)} ${r.postal.slice(3)}`;

  // Simple rate limit per (hashed) IP — we never store raw IPs.
  const ipHash = ip ? await sha256(`${env.IP_SALT || "truthbridge"}:${ip}`) : null;
  if (ipHash) {
    const { n } = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM requests WHERE ip_hash = ? AND created_at > datetime('now', '-1 day')"
    ).bind(ipHash).first();
    if (n >= MAX_PER_IP_PER_DAY) return err("We've received several requests from your connection today. Please try again tomorrow.", 429);
  }

  // One Bible per person: refuse a repeat from the same email, or the same name at the same address.
  const repeat = await env.DB.prepare(
    `SELECT id FROM requests
     WHERE status != 'cancelled'
       AND ((? != '' AND email = ?) OR (postal = ? AND lower(address1) = lower(?) AND lower(name) = lower(?)))
     LIMIT 1`
  ).bind(r.email, r.email, r.postal, r.address1, r.name).first();
  if (repeat) {
    return err("Our records show you've already requested a Bible — we send one per person. If you think this is a mistake, please email contact@truthbridgeministries.org.", 409);
  }

  // Flag (but still accept) someone else at an address that requested in the last 12 months.
  const dup = await env.DB.prepare(
    `SELECT id FROM requests
     WHERE postal = ? AND lower(address1) = lower(?) AND status != 'cancelled'
       AND created_at > datetime('now', '-12 months')
     ORDER BY id LIMIT 1`
  ).bind(r.postal, r.address1).first();

  await env.DB.prepare(
    `INSERT INTO requests (name, email, phone, address1, address2, city, province, postal, language, heard, message, duplicate_of, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    r.name, r.email || null, r.phone || null, r.address1, r.address2 || null, r.city, r.province,
    r.postal, r.language, r.heard || null, r.message || null, dup ? dup.id : null, ipHash
  ).run();

  return Response.json({ ok: true });
}

export function onRequest() {
  return err("Method not allowed", 405);
}
