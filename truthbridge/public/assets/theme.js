// Light / Dark / System theme. Loaded in <head> (not deferred) so the page never flashes the wrong theme.
(function () {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem("tb_theme"); } catch {}
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;

  document.addEventListener("DOMContentLoaded", () => {
    const buttons = document.querySelectorAll("[data-theme-choice]");
    const mark = () => buttons.forEach(b =>
      b.setAttribute("aria-pressed", String(b.dataset.themeChoice === (root.dataset.theme || "system"))));
    buttons.forEach(b => b.addEventListener("click", () => {
      const choice = b.dataset.themeChoice;
      if (choice === "system") delete root.dataset.theme; else root.dataset.theme = choice;
      try { choice === "system" ? localStorage.removeItem("tb_theme") : localStorage.setItem("tb_theme", choice); } catch {}
      mark();
    }));
    mark();
  });
})();
