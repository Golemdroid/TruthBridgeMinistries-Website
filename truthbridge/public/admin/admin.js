(function () {
  const $ = id => document.getElementById(id);
  const STATUSES = ["new", "packed", "shipped", "cancelled"];
  let token = sessionStorage.getItem("tb_admin") || "";
  let status = "new";
  let searchTimer;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (res.status === 401) { signOut(); throw new Error("Wrong password."); }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
    return res;
  }

  function signOut() {
    token = "";
    sessionStorage.removeItem("tb_admin");
    $("app").hidden = true; $("logout").hidden = true; $("login").hidden = false;
  }

  async function load() {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if ($("q").value.trim()) params.set("q", $("q").value.trim());
    const data = await (await api(`/api/admin/requests?${params}`)).json();
    renderTabs(data.counts);
    renderRows(data.requests);
  }

  function renderTabs(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    $("tabs").innerHTML = [...STATUSES, "all"].map(s => {
      const n = s === "all" ? total : (counts[s] || 0);
      return `<button class="tab" data-s="${s}" aria-pressed="${s === status}">${s[0].toUpperCase() + s.slice(1)} (${n})</button>`;
    }).join("");
  }

  function renderRows(list) {
    $("all").checked = false;
    if (!list.length) { $("rows").innerHTML = `<tr><td colspan="7" class="muted">No requests here.</td></tr>`; return; }
    $("rows").innerHTML = list.map(r => `
      <tr>
        <td><input type="checkbox" class="sel" value="${r.id}"></td>
        <td>${r.id}${r.duplicate_of ? `<div class="dup">Repeat of #${r.duplicate_of}</div>` : ""}</td>
        <td class="muted">${esc(r.created_at.slice(0, 10))}</td>
        <td><strong>${esc(r.name)}</strong><br>${esc(r.address1)}${r.address2 ? "<br>" + esc(r.address2) : ""}<br>
            ${esc(r.city)} ${esc(r.province)}&nbsp; ${esc(r.postal)}
            ${r.email || r.phone ? `<div class="muted">${esc(r.email || "")} ${esc(r.phone || "")}</div>` : ""}</td>
        <td>${esc(r.language)}</td>
        <td class="msg">${esc(r.message || "")}${r.heard ? `<div class="muted">Heard via: ${esc(r.heard)}</div>` : ""}</td>
        <td>
          <select data-id="${r.id}" class="status-sel">${STATUSES.map(s => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select>
          ${r.shipped_at ? `<div class="muted">Shipped ${esc(r.shipped_at.slice(0, 10))}</div>` : ""}
        </td>
      </tr>`).join("");
  }

  async function setStatus(ids, s) {
    if (!ids.length) return alert("Select at least one request first.");
    await api("/api/admin/requests", { method: "PATCH", body: JSON.stringify({ ids, status: s }) });
    await load();
  }
  const selected = () => [...document.querySelectorAll(".sel:checked")].map(c => Number(c.value));

  $("login").addEventListener("submit", async e => {
    e.preventDefault();
    token = $("token").value;
    try {
      await load();
      sessionStorage.setItem("tb_admin", token);
      $("login").hidden = true; $("app").hidden = false; $("logout").hidden = false;
    } catch (err) {
      $("login-msg").textContent = err.message; $("login-msg").className = "form-msg err";
    }
  });
  $("logout").addEventListener("click", e => { e.preventDefault(); signOut(); });
  $("tabs").addEventListener("click", e => { const b = e.target.closest(".tab"); if (b) { status = b.dataset.s; load(); } });
  $("q").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 300); });
  $("all").addEventListener("change", e => document.querySelectorAll(".sel").forEach(c => (c.checked = e.target.checked)));
  $("rows").addEventListener("change", e => {
    if (e.target.classList.contains("status-sel")) setStatus([Number(e.target.dataset.id)], e.target.value).catch(err => alert(err.message));
  });
  $("mark-packed").addEventListener("click", () => setStatus(selected(), "packed").catch(err => alert(err.message)));
  $("mark-shipped").addEventListener("click", () => setStatus(selected(), "shipped").catch(err => alert(err.message)));
  $("export").addEventListener("click", async () => {
    try {
      const qs = status === "all" ? "" : `?status=${status}`;
      const res = await api(`/api/admin/export${qs}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (res.headers.get("Content-Disposition") || "").match(/filename="(.+)"/)?.[1] || "requests.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) { alert(err.message); }
  });
  $("footnote").textContent = "Tip: download the 'New' list as CSV to print mailing labels, then mark them shipped.";

  if (token) {
    load().then(() => { $("login").hidden = true; $("app").hidden = false; $("logout").hidden = false; }).catch(() => signOut());
  }
})();
