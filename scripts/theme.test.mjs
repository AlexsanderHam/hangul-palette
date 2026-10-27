import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../assets/theme.js", import.meta.url), "utf8");
const key = "hangul-palette-theme";
const emit = (target, type, fields = {}) => target.dispatchEvent(Object.assign(new Event(type), fields));

function button() {
  const attributes = new Map();
  return Object.assign(new EventTarget(), {
    disabled: true, title: "",
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: (name) => attributes.get(name) ?? null,
  });
}

function page({ dark = false, saved = null, blocked = false } = {}) {
  let ready = false;
  const values = new Map(saved === null ? [] : [[key, saved]]);
  const media = Object.assign(new EventTarget(), { matches: dark });
  const toggle = button();
  const root = { dataset: {}, style: {} };
  const meta = { content: "#f8f7f3" };
  const document = Object.assign(new EventTarget(), {
    documentElement: root,
    querySelector: (selector) => selector === 'meta[name="theme-color"]' ? meta : null,
    getElementById: (id) => ready && id === "theme-toggle" ? toggle : null,
  });
  const window = Object.assign(new EventTarget(), { matchMedia: () => media });
  Object.defineProperty(window, "localStorage", { get() {
    if (blocked) throw new Error("Storage denied");
    return {
      getItem: (name) => values.get(name) ?? null,
      setItem: (name, value) => values.set(name, value),
    };
  } });
  runInNewContext(source, { window, document });
  return {
    root, meta, toggle,
    stored: () => values.get(key) ?? null,
    ready() { ready = true; emit(document, "DOMContentLoaded"); },
    switchTheme() { emit(toggle, "click"); },
    system(value) { media.matches = value; emit(media, "change"); },
    storage(name, value) {
      if (name === null) values.clear();
      else if (value === null) values.delete(name);
      else values.set(name, value);
      emit(window, "storage", { key: name, newValue: value });
    },
  };
}

function appearance(page, theme, systemMode) {
  assert.equal(page.root.dataset.theme, theme);
  assert.equal(page.root.style.colorScheme, theme);
  assert.equal(page.meta.content, theme === "dark" ? "#151a17" : "#f8f7f3");
  if (systemMode === undefined) return;
  const action = theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환";
  assert.equal(page.toggle.getAttribute("aria-label"), action);
  assert.equal(page.toggle.title, action + (systemMode ? " · 시스템 설정을 따르는 중" : ""));
}

test("a new visitor follows either system appearance, including later changes", () => {
  for (const dark of [false, true]) {
    const p = page({ dark });
    appearance(p, dark ? "dark" : "light");
    assert.equal(p.toggle.disabled, true);
    p.ready();
    assert.equal(p.toggle.disabled, false);
    appearance(p, dark ? "dark" : "light", true);
    p.system(!dark);
    appearance(p, dark ? "light" : "dark", true);
    assert.equal(p.stored(), null);
    p.switchTheme();
    appearance(p, dark ? "dark" : "light", false);
    assert.equal(p.stored(), dark ? "dark" : "light");
  }
});

test("saved choices apply before the page controls exist", () => {
  for (const saved of ["light", "dark"]) {
    const p = page({ dark: saved === "light", saved });
    appearance(p, saved);
    assert.equal(p.toggle.disabled, true);
    p.ready();
    appearance(p, saved, false);
  }
  appearance(page({ dark: true, saved: "invalid" }), "dark");
});

test("manual selection persists across navigation and ignores system changes", () => {
  const p = page();
  p.ready();
  p.switchTheme();
  appearance(p, "dark", false);
  assert.equal(p.stored(), "dark");
  p.system(true);
  p.system(false);
  appearance(p, "dark", false);
  const next = page({ saved: p.stored() });
  appearance(next, "dark");
  next.ready();
  next.switchTheme();
  next.system(true);
  appearance(next, "light", false);
  assert.equal(next.stored(), "light");
});

test("removing or clearing a saved override restores live system appearance", () => {
  for (const clearedKey of [key, null]) {
    const p = page({ dark: true, saved: "light" });
    p.ready();
    p.storage(clearedKey, null);
    appearance(p, "dark", true);
    assert.equal(p.stored(), null);
    p.system(false);
    appearance(p, "light", true);
  }
});

test("other tabs synchronize manual choices and invalid values", () => {
  const p = page({ dark: true, saved: "light" });
  p.ready();
  p.storage("unrelated", "dark");
  appearance(p, "light", false);
  p.storage(key, "dark");
  appearance(p, "dark", false);
  p.switchTheme();
  appearance(p, "light", false);
  assert.equal(p.stored(), "light");
  p.storage(key, "dark");
  p.storage(key, "invalid");
  appearance(p, "dark", true);
  p.system(false);
  appearance(p, "light", true);
});

test("blocked storage does not prevent manual changes or system mode", () => {
  const p = page({ blocked: true });
  appearance(p, "light");
  p.ready();
  p.system(true);
  appearance(p, "dark", true);
  p.switchTheme();
  appearance(p, "light", false);
  p.system(false);
  p.system(true);
  appearance(p, "light", false);
  p.switchTheme();
  appearance(p, "dark", false);
});
