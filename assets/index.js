import { createZip, saveFile } from "./download.js";

const byId = (id) => document.getElementById(id);
const base = new URL("../", import.meta.url);
const specimen = byId("specimen");
const text = byId("text");
const weight = byId("weight");
const preset = byId("preset");
const colorHint = CSS.supports("font-palette", "--user-palette")
  ? "색상은 CSS에 적용됩니다. 폰트 기본색은 검정입니다."
  : "이 브라우저는 영역별 색상 미리보기를 지원하지 않습니다. 색상 설정과 CSS 다운로드는 사용할 수 있습니다.";
const colorFields = new Map();
const cachedFiles = new Map();
const paletteStyle = document.createElement("style");
document.head.append(paletteStyle);
let manifest;
let colors = [];
let fontRequest = 0;

async function readFile(path) {
  if (!cachedFiles.has(path)) {
    const request = fetch(new URL(path, base)).then(async (response) => {
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    }).catch((error) => {
      cachedFiles.delete(path);
      throw error;
    });
    cachedFiles.set(path, request);
  }
  return cachedFiles.get(path);
}

function paletteCss() {
  return `@font-palette-values --my-hangul {
  font-family: "Hangul Palette";
  base-palette: 0;
  override-colors:
${colors.map((color, index) => `    ${index} ${color}`).join(",\n")};
}

.hangul-palette--custom {
  font-palette: --my-hangul;
  font-weight: ${weight.value};
  color: ${byId("text-color").value};
}
`;
}

function updatePalette() {
  const declarations = colors.map((color, index) => `${index} ${color}`).join(",");
  paletteStyle.textContent = `@font-palette-values --user-palette { font-family:"Hangul Palette"; base-palette:0; override-colors:${declarations}; } .custom-palette { font-palette:--user-palette; }`;
  document.documentElement.style.setProperty("--plain-color", byId("text-color").value);
  byId("palette-strip").replaceChildren(...colors.map((color) => {
    const swatch = document.createElement("i");
    swatch.style.setProperty("--swatch", color);
    return swatch;
  }));
  byId("css-output").textContent = paletteCss();
}

function bindColorInputs(picker, hex, onChange) {
  const apply = (value) => {
    picker.value = hex.value = value.toLowerCase();
    hex.removeAttribute("aria-invalid");
    if (manifest) byId("palette-state").textContent = colorHint;
    onChange(picker.value);
  };
  picker.addEventListener("input", () => apply(picker.value));
  hex.addEventListener("input", () => {
    if (/^#[\da-f]{6}$/i.test(hex.value)) apply(hex.value);
    else hex.setAttribute("aria-invalid", "true");
  });
  hex.addEventListener("blur", () => {
    if (hex.getAttribute("aria-invalid") !== "true") return;
    hex.value = picker.value;
    hex.removeAttribute("aria-invalid");
    byId("palette-state").textContent = "색상은 #RRGGBB 형식으로 입력하세요. 이전 색상을 유지했습니다.";
  });
}

function renderColors() {
  const groups = [
    ["initial", "초성"],
    ["medial", "중성"],
    ["final", "종성"],
  ].map(([role, name]) => {
    const slots = manifest.slots.filter((slot) => slot.role === role);
    const group = document.createElement("details");
    group.className = "color-group";
    group.open = role === "initial";
    const summary = document.createElement("summary");
    summary.append(name);
    const count = document.createElement("small");
    count.textContent = `${slots.length}개 영역`;
    summary.append(count);
    const fields = document.createElement("div");
    fields.className = "color-fields";
    for (const slot of slots) {
      const row = document.createElement("div");
      row.className = "color-field";
      const picker = document.createElement("input");
      picker.type = "color";
      picker.id = `color-${slot.index}`;
      picker.value = colors[slot.index];
      picker.setAttribute("aria-label", `${slot.label} 색상`);
      picker.title = "눌러서 색상 선택";
      const label = document.createElement("label");
      label.htmlFor = picker.id;
      label.textContent = slot.label.replace(/^(초성|중성|종성) /, "").replace(" 구성 자모", "");
      label.title = slot.id;
      const index = document.createElement("small");
      index.textContent = String(slot.index).padStart(2, "0");
      label.append(index);
      const hex = document.createElement("input");
      hex.className = "hex-input";
      hex.type = "text";
      hex.value = colors[slot.index];
      hex.maxLength = 7;
      hex.spellcheck = false;
      hex.autocomplete = "off";
      hex.setAttribute("aria-label", `${slot.label} 16진수 색상`);
      bindColorInputs(picker, hex, (value) => {
        colors[slot.index] = value;
        preset.value = "custom";
        updatePalette();
      });
      colorFields.set(slot.index, { picker, hex });
      const control = document.createElement("div");
      control.className = "color-control";
      control.append(picker, hex);
      row.append(label, control);
      fields.append(row);
    }
    group.append(summary, fields);
    return group;
  });
  byId("color-groups").replaceChildren(...groups);
}

function selectPreset() {
  const roleColors = { initial: "#f43f5e", medial: "#f59e0b", final: "#14b8a6" };
  const forestColors = { initial: "#22c55e", medial: "#0ea5e9", final: "#84cc16" };
  colors = manifest.slots.map((slot) => {
    if (preset.value === "black") return "#000000";
    if (preset.value === "roles") return roleColors[slot.role];
    if (preset.value === "forest") return forestColors[slot.role];
    return slot.color;
  });
  for (const [index, field] of colorFields) {
    field.picker.value = field.hex.value = colors[index];
    field.hex.removeAttribute("aria-invalid");
  }
  updatePalette();
}

function updateText() {
  specimen.textContent = text.value;
  for (const row of document.querySelectorAll(".weight-row p")) row.textContent = text.value;
  for (const button of document.querySelectorAll("[data-sample]")) {
    button.setAttribute("aria-pressed", String(button.dataset.sample === text.value));
  }
  byId("text-count").textContent = `${text.value.length} / 500`;
}

async function loadWeight() {
  const request = ++fontRequest;
  specimen.style.fontWeight = weight.value;
  document.querySelector(".latin-sample").style.fontWeight = weight.value;
  const label = weight.selectedOptions[0].textContent;
  byId("font-state").classList.remove("failed");
  byId("font-state").textContent = `${label} 불러오는 중…`;
  try {
    const loaded = await document.fonts.load(`${weight.value} 72px "Hangul Palette"`, "한글가");
    if (!loaded.length) throw new Error("Font not available");
    if (request === fontRequest) byId("font-state").textContent = `${label} 준비됨`;
  } catch {
    if (request !== fontRequest) return;
    byId("font-state").classList.add("failed");
    byId("font-state").textContent = "폰트를 불러오지 못했습니다. 새로고침해 주세요.";
  }
}

function downloadState(message, failed = false) {
  byId("download-state").textContent = message;
  byId("download-state").classList.toggle("failed", failed);
}

async function stylesheet(custom) {
  return new TextDecoder().decode(await readFile("css/hangul-palette.css")) + "\n/* Your palette */\n" + custom;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

byId("download-fonts").addEventListener("click", async () => {
  const button = byId("download-fonts");
  const custom = paletteCss();
  const sample = text.value;
  button.disabled = true;
  downloadState("폰트 9개와 CSS를 준비하고 있습니다…");
  let completed = 0;
  let active = true;
  try {
    const [fonts, css, license, notice] = await Promise.all([
      Promise.all(manifest.weights.map(async ({ fontFile }) => {
        const bytes = await readFile(fontFile);
        if (active) downloadState(`폰트 ${++completed} / 9개 준비됨…`);
        return [fontFile, bytes];
      })),
      stylesheet(custom), readFile("LICENSE"), readFile("NOTICE"),
    ]);
    const preview = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hangul Palette</title><link rel="stylesheet" href="css/hangul-palette.css"><style>body{margin:40px;font-family:system-ui,sans-serif}p{font-size:clamp(28px,8vw,72px);line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}</style><p class="hangul-palette hangul-palette--custom">${escapeHtml(sample)}</p></html>\n`;
    const readme = "Hangul Palette\n\nCopy fonts/ and css/ to your web project, keeping their relative locations.\nLoad css/hangul-palette.css and apply the classes:\n  hangul-palette hangul-palette--custom\n\nThe CSS includes the palette and weight selected on the website.\nEdit @font-palette-values --my-hangul to change colors.\nThe font files themselves retain their default black palette.\n\nOpen preview.html through a local web server to see your selection.\nKeep LICENSE and NOTICE with redistributed fonts.\n\nhttps://github.com/AlexsanderHam/hangul-palette\n";
    saveFile(`hangul-palette-${manifest.version}.zip`, createZip([...fonts, ["css/hangul-palette.css", css], ["LICENSE", license], ["NOTICE", notice], ["preview.html", preview], ["README.txt", readme]]));
    downloadState("다운로드를 시작했습니다. 현재 색상이 CSS에 포함되어 있습니다.");
  } catch {
    active = false;
    downloadState("파일을 준비하지 못했습니다. 연결을 확인한 뒤 다시 눌러주세요.", true);
  } finally {
    active = false;
    button.disabled = false;
  }
});

byId("download-css").addEventListener("click", async () => {
  const custom = paletteCss();
  const button = byId("download-css");
  button.disabled = true;
  try {
    saveFile("hangul-palette.css", await stylesheet(custom));
    downloadState("현재 색상이 담긴 CSS를 다운로드했습니다. css/에 넣어 사용하세요.");
  } catch {
    downloadState("CSS를 불러오지 못했습니다. 연결을 확인한 뒤 다시 눌러주세요.", true);
  } finally {
    button.disabled = false;
  }
});

byId("copy-css").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(paletteCss());
    byId("copy-css").textContent = "복사됨";
    setTimeout(() => { byId("copy-css").textContent = "CSS 복사"; }, 2000);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(byId("css-output"));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    downloadState("CSS를 선택했습니다. 복사 단축키로 복사해 주세요.");
  }
});

text.addEventListener("input", updateText);
for (const button of document.querySelectorAll("[data-sample]")) button.addEventListener("click", () => {
  text.value = button.dataset.sample;
  updateText();
});
weight.addEventListener("change", () => { loadWeight(); if (manifest) updatePalette(); });
byId("size").addEventListener("input", (event) => {
  const value = event.target.value;
  document.documentElement.style.setProperty("--preview-size", `${value}px`);
  byId("size-value").textContent = `${value} px`;
});
bindColorInputs(byId("text-color"), byId("text-color-hex"), () => { if (manifest) updatePalette(); });
preset.addEventListener("change", selectPreset);
byId("reset-colors").addEventListener("click", () => {
  preset.value = "spectrum";
  byId("text-color").value = byId("text-color-hex").value = "#202321";
  byId("text-color-hex").removeAttribute("aria-invalid");
  byId("palette-state").textContent = colorHint;
  selectPreset();
});

updateText();
loadWeight();
try {
  manifest = JSON.parse(new TextDecoder().decode(await readFile("metadata/manifest.json")));
  colors = manifest.slots.map((slot) => slot.color);
  renderColors();
  updatePalette();
  for (const id of ["preset", "reset-colors", "download-fonts", "download-css", "copy-css"]) byId(id).disabled = false;
  byId("palette-state").textContent = colorHint;
} catch {
  byId("color-groups").textContent = "색상 정보를 불러오지 못했습니다. 페이지를 새로고침해 주세요.";
  byId("palette-state").textContent = "폰트는 GitHub 저장소에서도 받을 수 있습니다.";
}
