// Impact dashboard: KPIs, Canada map and province leaderboard.
// Reads live totals from /api/impact; until the database is connected it shows SAMPLE figures and says so.
(function () {
  const root = document.getElementById("impact-dashboard");
  if (!root) return;

  // Placeholder figures, used only when /api/impact isn't available.
  const SAMPLE = {
    requested: 205,
    shipped: 199,
    shippingBasis: 193,
    fulfillmentDays: 16.48,
    bibleCost: 3.76,
    shippingCost: 7.96,
    provinces: { ON: 105, AB: 26, BC: 19, QC: 18, MB: 11, NB: 5, NL: 5, SK: 5, NS: 3, NT: 1, YT: 1, NU: 0, PE: 0 },
  };
  const NAMES = {
    AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador",
    NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island",
    QC: "Quebec", SK: "Saskatchewan", YT: "Yukon",
  };
  const BUCKETS = [1, 6, 21, 51]; // 0 | 1–5 | 6–20 | 21–50 | 51+
  const bucket = n => BUCKETS.filter(t => n >= t).length;

  const $ = sel => root.querySelector(sel);
  const money = v => v == null ? "—" : v.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
  const count = v => v == null ? "—" : v.toLocaleString("en-CA");
  const plural = (n, word) => `${count(n)} ${word}${n === 1 ? "" : "s"}`;
  const svgNS = "http://www.w3.org/2000/svg";

  let data = null;
  let selected = null;

  function renderKpis() {
    const reached = Object.values(data.provinces).filter(n => n > 0).length;
    const set = (key, value, note) => {
      $(`[data-kpi="${key}"] .kpi-value`).textContent = value;
      $(`[data-kpi="${key}"] .kpi-note`).textContent = note;
    };
    set("shipped", count(data.shipped), `of ${plural(data.requested, "request")} received`);
    set("reached", count(reached), "provinces and territories with shipped Bibles");
    set("bible", money(data.bibleCost), "per Bible, excluding shipping");
    set("shipping", money(data.shippingCost), `average per Bible, from ${plural(data.shippingBasis ?? data.shipped, "shipment")}`);
    set("days", data.fulfillmentDays == null ? "—" : `${data.fulfillmentDays.toFixed(1)} days`, "average from request to shipped");
  }

  function renderLeaderboard() {
    const rows = Object.keys(NAMES)
      .map(id => ({ id, n: data.provinces[id] || 0 }))
      .sort((a, b) => b.n - a.n || NAMES[a.id].localeCompare(NAMES[b.id]));
    const max = Math.max(1, ...rows.map(r => r.n));
    const list = $("#impact-board");
    list.replaceChildren(...rows.map(r => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.region = r.id;
      btn.innerHTML = `<span class="board-name"></span><span class="board-count"></span><span class="board-bar"><span></span></span>`;
      btn.querySelector(".board-name").textContent = NAMES[r.id];
      btn.querySelector(".board-count").textContent = count(r.n);
      btn.querySelector(".board-bar span").style.width = `${(r.n / max) * 100}%`;
      btn.addEventListener("click", () => select(r.id));
      li.append(btn);
      return li;
    }));
  }

  function renderMap(geo) {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", geo.viewBox);
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "Map of Canada showing Bibles shipped per province and territory");
    for (const r of geo.regions) {
      const n = data.provinces[r.id] || 0;
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", r.d);
      path.setAttribute("class", `region b${bucket(n)}`);
      path.setAttribute("tabindex", "0");
      path.setAttribute("aria-label", `${NAMES[r.id]}: ${plural(n, "Bible")} shipped`);
      path.dataset.region = r.id;
      const title = document.createElementNS(svgNS, "title");
      title.textContent = `${NAMES[r.id]} — ${plural(n, "Bible")} shipped`;
      path.append(title);
      path.addEventListener("click", () => select(r.id));
      path.addEventListener("focus", () => select(r.id));
      svg.append(path);
    }
    $("#impact-map").replaceChildren(svg);
  }

  function select(id) {
    selected = id;
    root.querySelectorAll("[data-region]").forEach(el => el.classList.toggle("is-selected", el.dataset.region === selected));
    const out = $("#impact-selected");
    if (!selected) { out.textContent = "Select a province or territory on the map or in the list."; return; }
    const n = data.provinces[selected] || 0;
    const share = data.shipped ? Math.round((n / data.shipped) * 100) : 0;
    out.innerHTML = "<strong></strong> ";
    out.querySelector("strong").textContent = NAMES[selected];
    out.append(`${plural(n, "Bible")} shipped${n ? ` · ${share}% of all shipments` : ""}`);
  }

  function useData(d, isSample) {
    data = d;
    root.classList.toggle("is-sample", isSample);
    $("#impact-sample").hidden = !isSample;
    renderKpis();
    renderLeaderboard();
  }

  // Load the map outlines only when the section is close to the screen.
  function loadMap() {
    fetch("/assets/canada-map.json")
      .then(r => r.json())
      .then(renderMap)
      .catch(() => { $("#impact-map").textContent = "The map couldn't be loaded."; });
  }

  fetch("/api/impact")
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(d => useData(d, false))
    .catch(() => useData(SAMPLE, true))
    .finally(() => {
      if (!("IntersectionObserver" in window)) return loadMap();
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { io.disconnect(); loadMap(); }
      }, { rootMargin: "400px" });
      io.observe($("#impact-map"));
    });
})();
