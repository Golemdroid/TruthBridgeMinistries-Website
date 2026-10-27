(function () {
  document.getElementById("year").textContent = new Date().getFullYear();

  const form = document.getElementById("bible-form");
  const msg = document.getElementById("form-msg");
  const btn = document.getElementById("submit-btn");
  const success = document.getElementById("success");
  const POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

  // Optional Cloudflare Turnstile (spam protection) — only loads if configured.
  let turnstileOn = false;
  fetch("/api/config").then(r => r.ok ? r.json() : {}).then(cfg => {
    if (!cfg.turnstileSiteKey) return;
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
