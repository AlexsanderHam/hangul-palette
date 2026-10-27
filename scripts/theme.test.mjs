import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../assets/theme.js", import.meta.url), "utf8");
const key = "hangul-palette-theme";
const emit = (target, type, fields = {}) => target.dispatchEvent(Object.assign(new Event(type), fields));

function page({ dark = false, saved = null, blocked = false } = {}) {
  let ready = false;
  const values = new Map(saved === null ? [] : [[key, saved]]);
  const media = Object.assign(new EventTarget(), { matches: dark });
  const control = Object.assign(new EventTarget(), { value: "system", disabled: true });
  const root = { dataset: {}, style: {} };
  const meta = { content: "#f8f7f3" };
  const document = Object.assign(new EventTarget(), {
    documentElement: root,
    querySelector: (selector) => selector === 'meta[name="theme-color"]' ? meta : null,
    getElementById: (id) => ready && id === "theme" ? control : null,
  });
  const window = Object.assign(new EventTarget(), { matchMedia: () => media });
  Object.defineProperty(window, "localStorage", { get() {
    if (blocked) throw new Error("Storage denied");
    return {
      getItem: (name) => values.get(name) ?? null,
      setItem: (name, value) => values.set(name, value),
      removeItem: (name) => values.delete(name),
    };
  } });
  runInNewContext(source, { window, document });
  return {
    root, meta, control,
    stored: () => values.get(key) ?? null,
    ready() { ready = true; emit(document, "DOMContentLoaded"); },
    choose(value) { control.value = value; emit(control, "change"); },
    system(value) { media.matches = value; emit(media, "change"); },
    storage(name, value) { emit(window, "storage", { key: name, newValue: value }); },
  };
}

function appearance(page, theme) {
  assert.equal(page.root.dataset.theme, theme);
  assert.equal(page.root.style.colorScheme, theme);
  assert.equal(page.meta.content, theme === "dark" ? "#151a17" : "#f8f7f3");
}

test("a new visitor follows either system appearance, including later changes", () => {
  for (const dark of [false, true]) {
    const p = page({ dark });
    appearance(p, dark ? "dark" : "light");
    assert.equal(p.control.disabled, true);
    p.ready();
    assert.equal(p.control.disabled, false);
    assert.equal(p.control.value, "system");
    p.system(!dark);
    appearance(p, dark ? "light" : "dark");
    assert.equal(p.stored(), null);
  }
});

test("saved choices apply before the page controls exist", () => {
  for (const saved of ["light", "dark"]) {
    const p = page({ dark: saved === "light", saved });
    appearance(p, saved);
    assert.equal(p.control.disabled, true);
    p.ready();
    assert.equal(p.control.value, saved);
  }
  appearance(page({ dark: true, saved: "invalid" }), "dark");
});

test("manual selection persists across navigation and ignores system changes", () => {
  const p = page();
  p.ready();
  p.choose("dark");
  appearance(p, "dark");
  assert.equal(p.stored(), "dark");
  p.system(true);
  p.system(false);
  appearance(p, "dark");
  const next = page({ saved: p.stored() });
  appearance(next, "dark");
  next.ready();
  next.choose("light");
  next.system(true);
  appearance(next, "light");
  assert.equal(next.stored(), "light");
});

test("returning to system removes the override and resumes live updates", () => {
  const p = page({ dark: true, saved: "light" });
  p.ready();
  p.choose("system");
  appearance(p, "dark");
  assert.equal(p.control.value, "system");
  assert.equal(p.stored(), null);
  p.system(false);
  appearance(p, "light");
});

test("other tabs synchronize changes, clearing and invalid values", () => {
  const p = page({ dark: true, saved: "light" });
  p.ready();
  p.storage("unrelated", "dark");
  appearance(p, "light");
  p.storage(key, "dark");
  appearance(p, "dark");
  assert.equal(p.control.value, "dark");
  p.storage(null, null);
  assert.equal(p.control.value, "system");
  p.system(false);
  appearance(p, "light");
  p.storage(key, "dark");
  p.storage(key, "invalid");
  appearance(p, "light");
  assert.equal(p.control.value, "system");
});

test("blocked storage does not prevent manual changes or system mode", () => {
  const p = page({ blocked: true });
  appearance(p, "light");
  p.ready();
  p.choose("dark");
  appearance(p, "dark");
  p.choose("system");
  p.system(true);
  appearance(p, "dark");
  assert.equal(p.control.value, "system");
});
