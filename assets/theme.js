(() => {
  const key = "hangul-palette-theme";
  const choices = new Set(["system", "light", "dark"]);
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const normalize = (value) => choices.has(value) ? value : "system";
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
    const control = document.getElementById("theme");
    if (control) control.value = preference;
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
    const control = document.getElementById("theme");
    control.value = preference;
    control.disabled = false;
    control.addEventListener("change", () => {
      if (!choices.has(control.value)) return;
      preference = control.value;
      try {
        if (preference === "system") window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, preference);
      } catch {
        // Keep the current page usable without persistent storage.
      }
      apply();
    });
  }, { once: true });
})();
