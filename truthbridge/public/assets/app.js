(function () {
  document.getElementById("year").textContent = new Date().getFullYear();

  const form = document.getElementById("bible-form");
  const msg = document.getElementById("form-msg");
  const btn = document.getElementById("submit-btn");
  const success = document.getElementById("success");
  const POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

  const fmtDate = iso => new Date(iso + "T00:00:00Z")
    .toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  // Monthly cap: show how many are left, or swap the form for the "requests full" panel.
  function applyCapacity(req) {
    document.querySelectorAll("[data-limit]").forEach(el => (el.textContent = req.limit));
    if (req.open) {
      if (req.remaining != null) {
        document.getElementById("notice-text").innerHTML =
          `<strong>Requests are open</strong>${req.remaining} of ${req.limit} free Bibles left this month. Requests are processed within 1–2 weeks.`;
      }
      return;
    }
    const reopens = fmtDate(req.reopens);
    document.getElementById("notice").classList.add("full");
    document.getElementById("notice-text").innerHTML =
      `<strong>Monthly request limit reached</strong>We've sent our ${req.limit} free Bibles for this month. Requests reopen ${reopens}.`;
    document.querySelectorAll("[data-reopens]").forEach(el => (el.textContent = reopens));
    form.hidden = true;
    document.getElementById("closed-panel").hidden = false;
    document.getElementById("closing-title").textContent = `Requests reopen ${reopens}.`;
    const cb = document.getElementById("closing-btn");
    cb.textContent = "Monthly request limit reached";
    cb.classList.add("is-disabled");
    cb.setAttribute("aria-disabled", "true");
    cb.removeAttribute("href");
  }

  // Add ?preview=full to the URL to see the "requests full" state without a database (e.g. on Vercel).
  const previewFull = new URLSearchParams(location.search).get("preview") === "full";
  if (previewFull) {
    const next = new Date();
    applyCapacity({ open: false, limit: 20, reopens: new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1)).toISOString().slice(0, 10) });
  }

  // Optional Cloudflare Turnstile (spam protection) — only loads if configured.
  let turnstileOn = false;
  fetch("/api/config").then(r => r.ok ? r.json() : {}).then(cfg => {
    if (cfg.requests && !previewFull) applyCapacity(cfg.requests);
    if (!cfg.turnstileSiteKey || previewFull || (cfg.requests && !cfg.requests.open)) return;
    turnstileOn = true;
    window.onTurnstileLoad = () => window.turnstile.render("#turnstile", { sitekey: cfg.turnstileSiteKey });
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
    s.async = true;
    document.head.appendChild(s);
  }).catch(() => {});

  function show(text, kind) {
    msg.textContent = text;
    msg.className = "form-msg " + kind;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    if (!data.name?.trim() || !data.address1?.trim() || !data.city?.trim() || !data.province) {
      return show("Please fill in your name and full mailing address.", "err");
    }
    if (!POSTAL.test((data.postal || "").trim())) {
      return show("Please enter a valid Canadian postal code (e.g. M5V 2T6).", "err");
    }
    if (!form.consent.checked) {
      return show("Please tick the box to agree to the privacy policy.", "err");
    }
    if (turnstileOn) {
      data["cf-turnstile-response"] = window.turnstile?.getResponse() || "";
    }
    data.consent = true;

    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (out.full) return applyCapacity({ open: false, limit: document.querySelector("[data-limit]").textContent, reopens: out.reopens });
      if (!res.ok) throw new Error(out.error || "Something went wrong. Please try again.");
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      show(err.message, "err");
      if (turnstileOn) window.turnstile?.reset();
    } finally {
      btn.disabled = false;
      btn.textContent = "Send me a free Bible";
    }
  });
})();
