const weights = [
  [100, "Thin"], [200, "ExtraLight"], [300, "Light"],
  [400, "Regular"], [500, "Medium"], [600, "SemiBold"],
  [700, "Bold"], [800, "ExtraBold"], [900, "Black"],
];
const initials = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const medials = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
const finals = ["받침 없음", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];
// These are the complete encoded Hangul ranges in every distributed weight.
// Generate characters here instead of downloading the authoring geometry.
const syllables = Array.from({ length: 11172 }, (_, index) => String.fromCodePoint(0xac00 + index));
const jamo = Array.from({ length: 51 }, (_, index) => String.fromCodePoint(0x3131 + index));
const allCharacters = [...syllables, ...jamo];
const supported = new Set(allCharacters);
const byId = (id) => document.getElementById(id);
const viewport = byId("glyph-viewport");
const table = byId("glyph-table");
const rows = byId("glyph-rows");
const search = byId("search");
const scope = byId("scope");
const initial = byId("initial");
const medial = byId("medial");
const final = byId("final");
const size = byId("size");
const palette = byId("palette");
const dialog = byId("glyph-detail");
const number = new Intl.NumberFormat("ko-KR");
const headerHeight = 52;
const overscan = 5;
let rowHeight = 71;
let filtered = allCharacters;
let windowStart = -1;
let windowEnd = -1;
let frame = 0;
let searchTimer = 0;
let detailChar = null;
let activeIndex = 0;

for (const [element, labels] of [[initial, initials], [medial, medials], [final, finals]]) {
  labels.forEach((label, index) => element.add(new Option(label, String(index))));
}

function unicode(char) {
  return "U+" + char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
}

function parts(char) {
  const value = char.codePointAt(0) - 0xac00;
  return value < 0 ? null : [Math.floor(value / 588), Math.floor(value / 28) % 21, value % 28];
}

function queryCharacters(value) {
  // NFC composes pasted ᄀ + ᅡ while preserving compatibility jamo such as ㄱ.
  const term = value.trim().normalize("NFC");
  if (!term) return null;
  const code = /^(?:U\+|0x)?([0-9a-f]{4,6})$/i.exec(term);
  if (code) {
    const point = Number.parseInt(code[1], 16);
    return new Set(point <= 0x10ffff ? [String.fromCodePoint(point)] : []);
  }
  return new Set([...term].filter((char) => supported.has(char)));
}

function applyFilters() {
  clearTimeout(searchTimer);
  const query = queryCharacters(search.value);
  const source = scope.value === "jamo" ? jamo : scope.value === "syllables" ? syllables : allCharacters;
  filtered = source.filter((char) => {
    if (query && !query.has(char)) return false;
    const components = parts(char);
    if (!components) return initial.value === "" && medial.value === "" && final.value === "";
    return [initial, medial, final].every((element, index) => element.value === "" || Number(element.value) === components[index]);
  });
  viewport.scrollTop = 0;
  activeIndex = 0;
  windowStart = windowEnd = -1;
  byId("result-count").textContent = number.format(filtered.length);
  byId("search-status").textContent = `${number.format(filtered.length)}자, 아홉 가지 굵기`;
  table.setAttribute("aria-rowcount", String(filtered.length + 1));
  table.hidden = filtered.length === 0;
  byId("empty-state").hidden = filtered.length !== 0;
  byId("first").disabled = byId("last").disabled = filtered.length === 0;
  renderRows();
}

function spacer(height) {
  const row = document.createElement("tr");
  row.className = "spacer";
  row.setAttribute("aria-hidden", "true");
  const cell = document.createElement("td");
  cell.colSpan = 10;
  cell.style.height = height + "px";
  row.append(cell);
  return row;
}

function characterRow(char, index) {
  const row = document.createElement("tr");
  row.className = "glyph-row" + (char === detailChar ? " selected" : "");
  row.setAttribute("aria-rowindex", String(index + 2));
  const label = document.createElement("th");
  label.scope = "row";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "character-button";
  button.dataset.index = String(index);
  button.tabIndex = index === activeIndex ? 0 : -1;
  button.setAttribute("aria-label", `${char}, ${unicode(char)}, 아홉 굵기로 확대`);
  const character = document.createElement("span");
  character.className = "character";
  character.textContent = char;
  const code = document.createElement("span");
  code.className = "unicode";
  code.textContent = unicode(char);
  button.append(character, code);
  label.append(button);
  row.append(label);
  for (const [value] of weights) {
    const cell = document.createElement("td");
    const glyph = document.createElement("span");
    glyph.className = "font-glyph";
    glyph.style.fontWeight = String(value);
    glyph.textContent = char;
    cell.append(glyph);
    row.append(cell);
  }
  return row;
}

function renderRows(force = false) {
  frame = 0;
  if (!filtered.length) {
    rows.replaceChildren();
    byId("visible-range").textContent = "검색 결과 없음";
    return;
  }
  const firstVisible = Math.min(filtered.length - 1, Math.floor(viewport.scrollTop / rowHeight));
  const lastVisible = Math.min(filtered.length, Math.ceil((viewport.scrollTop + viewport.clientHeight - headerHeight) / rowHeight));
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(filtered.length, lastVisible + overscan);
  byId("visible-range").textContent = `${number.format(firstVisible + 1)}–${number.format(lastVisible)} / ${number.format(filtered.length)}자`;
  if (!force && start === windowStart && end === windowEnd) return;
  const focused = rows.contains(document.activeElement) ? document.activeElement.dataset.index : null;
  const fragment = document.createDocumentFragment();
  fragment.append(spacer(start * rowHeight));
  for (let index = start; index < end; index++) fragment.append(characterRow(filtered[index], index));
  fragment.append(spacer((filtered.length - end) * rowHeight));
  rows.replaceChildren(fragment);
  windowStart = start;
  windowEnd = end;
  if (focused !== null) {
    (rows.querySelector(`button[data-index="${focused}"]`) ?? viewport).focus({ preventScroll: true });
  }
}

function scheduleRows() {
  if (!frame) frame = requestAnimationFrame(() => renderRows());
}

function changeSize() {
  const anchor = Math.min(filtered.length - 1, Math.floor(viewport.scrollTop / rowHeight));
  const pixels = Number(size.value);
  rowHeight = Math.ceil(pixels * 1.45) + 18;
  document.documentElement.style.setProperty("--glyph-size", pixels + "px");
  document.documentElement.style.setProperty("--row-height", rowHeight + "px");
  document.documentElement.style.setProperty("--cell-width", Math.max(80, Math.ceil(pixels + 24)) + "px");
  byId("size-value").textContent = pixels + " px";
  // Set the new total height before restoring the same character as the anchor.
  windowStart = windowEnd = -1;
  renderRows(true);
  viewport.scrollTop = Math.max(0, anchor * rowHeight);
  renderRows(true);
}

function resetFilters() {
  search.value = "";
  scope.value = "all";
  for (const element of [initial, medial, final]) {
    element.value = "";
    element.disabled = false;
  }
  applyFilters();
}

function updateDetail(index) {
  detailChar = filtered[index];
  byId("detail-title").textContent = detailChar;
  const components = parts(detailChar);
  const description = components
    ? `${initials[components[0]]} + ${medials[components[1]]}${components[2] ? " + " + finals[components[2]] : ""}`
    : "호환 자모";
  byId("detail-description").textContent = `${unicode(detailChar)} · ${description}`;
  const cards = weights.map(([value, label]) => {
    const card = document.createElement("article");
    card.className = "detail-weight";
    const heading = document.createElement("h3");
    heading.append(document.createTextNode(label));
    const weight = document.createElement("span");
    weight.textContent = String(value);
    heading.append(weight);
    const glyph = document.createElement("p");
    glyph.className = "font-glyph";
    glyph.style.fontWeight = String(value);
    glyph.textContent = detailChar;
    card.append(heading, glyph);
    return card;
  });
  byId("detail-weights").replaceChildren(...cards);
  byId("previous-glyph").disabled = index === 0;
  byId("next-glyph").disabled = index === filtered.length - 1;
  renderRows(true);
}

function stepDetail(offset) {
  const index = filtered.indexOf(detailChar) + offset;
  if (index >= 0 && index < filtered.length) updateDetail(index);
}

function focusCharacter(index) {
  activeIndex = Math.max(0, Math.min(filtered.length - 1, index));
  const top = activeIndex * rowHeight + headerHeight;
  if (top < viewport.scrollTop + headerHeight) {
    viewport.scrollTop = activeIndex * rowHeight;
  } else if (top + rowHeight > viewport.scrollTop + viewport.clientHeight) {
    viewport.scrollTop = top + rowHeight - viewport.clientHeight;
  }
  renderRows(true);
  rows.querySelector(`button[data-index="${activeIndex}"]`)?.focus({ preventScroll: true });
}

function openDetail(index) {
  activeIndex = index;
  updateDetail(index);
  dialog.showModal();
}

function applyPalette() {
  document.documentElement.style.setProperty("--gallery-palette", palette.value);
  document.documentElement.dataset.preview = palette.value === "normal" ? "black" : "color";
}

search.addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  if (event.isComposing) return;
  searchTimer = setTimeout(applyFilters, 100);
});
search.addEventListener("compositionend", applyFilters);
scope.addEventListener("change", () => {
  for (const element of [initial, medial, final]) {
    element.value = "";
    element.disabled = scope.value === "jamo";
  }
  applyFilters();
});
for (const element of [initial, medial, final]) element.addEventListener("change", () => {
  if ([initial, medial, final].some((filter) => filter.value !== "")) scope.value = "syllables";
  applyFilters();
});
byId("reset").addEventListener("click", resetFilters);
byId("empty-reset").addEventListener("click", resetFilters);
palette.addEventListener("change", applyPalette);
size.addEventListener("input", changeSize);
viewport.addEventListener("scroll", scheduleRows, { passive: true });
viewport.addEventListener("keydown", (event) => {
  if (!filtered.length || event.altKey || event.ctrlKey || event.metaKey) return;
  const button = event.target.closest("button[data-index]");
  const firstVisible = Math.min(filtered.length - 1, Math.floor(viewport.scrollTop / rowHeight));
  const index = button ? Number(button.dataset.index) : firstVisible;
  const page = Math.max(1, Math.floor((viewport.clientHeight - headerHeight) / rowHeight));
  const destination = {
    ArrowUp: button ? index - 1 : index,
    ArrowDown: button ? index + 1 : index,
    Home: 0,
    End: filtered.length - 1,
    PageUp: index - page,
    PageDown: index + page,
  }[event.key];
  if (destination !== undefined) {
    event.preventDefault();
    focusCharacter(destination);
  } else if (!button && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openDetail(index);
  }
});
new ResizeObserver(scheduleRows).observe(viewport);
byId("first").addEventListener("click", () => { viewport.scrollTop = 0; renderRows(); });
byId("last").addEventListener("click", () => { viewport.scrollTop = viewport.scrollHeight; renderRows(); });
rows.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  openDetail(Number(button.dataset.index));
});
byId("close-detail").addEventListener("click", () => dialog.close());
byId("previous-glyph").addEventListener("click", () => stepDetail(-1));
byId("next-glyph").addEventListener("click", () => stepDetail(1));
dialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    stepDetail(event.key === "ArrowLeft" ? -1 : 1);
  }
});
dialog.addEventListener("close", () => {
  const index = filtered.indexOf(detailChar);
  if (index < 0) return;
  focusCharacter(index);
});

const paletteSupported = CSS.supports("font-palette", "--hangul-palette");
if (!paletteSupported) {
  palette.value = "normal";
  palette.disabled = true;
}
applyPalette();
applyFilters();

async function loadFonts() {
  const state = byId("font-state");
  const retry = byId("font-retry");
  state.textContent = "아홉 가지 굵기를 불러오는 중…";
  state.classList.remove("failed");
  retry.hidden = true;
  retry.disabled = true;
  const results = await Promise.allSettled(weights.map(([value]) => document.fonts.load(`${value} 36px "Hangul Palette"`, "가ㄱ")));
  const failed = results.flatMap((result, index) => result.status === "rejected" || !result.value.length ? [weights[index][1]] : []);
  state.textContent = failed.length
    ? `폰트를 불러오지 못했어요: ${failed.join(", ")}`
    : paletteSupported ? "9개 굵기 모두 준비됨" : "9개 굵기 준비됨 · 이 브라우저에서는 검정으로 표시됩니다.";
  state.classList.toggle("failed", failed.length > 0);
  retry.hidden = failed.length === 0;
  retry.disabled = false;
}

byId("font-retry").addEventListener("click", () => window.location.reload());
await loadFonts();
