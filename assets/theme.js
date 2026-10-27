(() => {
  const key = "hangul-palette-theme";
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const normalize = (value) => value === "light" || value === "dark" ? value : "system";
  let preference = "system";

  try {
    preference = normalize(window.localStorage.getItem(key));
  } catch {
    // The theme still works when browser storage is unavailable.
  }

  function apply() {
    const theme = preference === "system" ? (system.matches ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#151a17" : "#f8f7f3";
    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
      const action = theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환";
      toggle.setAttribute("aria-label", action);
      toggle.title = preference === "system" ? `${action} · 시스템 설정을 따르는 중` : action;
    }
  }

  function choose(value) {
    preference = value;
    try {
      window.localStorage.setItem(key, preference);
    } catch {
      // Keep the current page usable without persistent storage.
    }
    apply();
  }

  // Apply the saved choice before stylesheets and page content are painted.
  apply();

  system.addEventListener("change", () => {
    if (preference === "system") apply();
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    preference = normalize(event.newValue);
    apply();
  });

  document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("theme-toggle");
    toggle.disabled = false;
    toggle.addEventListener("click", () => {
      choose(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
    apply();
  }, { once: true });
})();
