import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (name) => readFile(resolve(root, name));
const manifest = JSON.parse(await read("metadata/manifest.json"));
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.family, "Hangul Palette");
assert.equal(manifest.format, "hangul-palette-color-font-v1");
assert.equal(manifest.fontFormat, "WOFF2 / CFF / COLR v1 with v0 fallback / CPAL v0");
assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.equal(manifest.fontVersion, manifest.version);
assert.equal(manifest.complete, true);
assert.equal(manifest.counts.weights, 9);
assert.equal(manifest.counts.characters, 11223);
assert.equal(manifest.slots.length, 20);
assert.equal(manifest.colorPolicy.fontDefault, "#000000");
assert.equal(manifest.inputs.selection, "checked-in-baseline");
assert.equal(manifest.provenance.inputs.palette, "contract-default");
assert.match(manifest.provenance.inputs.dataFileSha256, /^[a-f0-9]{64}$/);
assert.equal(manifest.provenance.studio.name, "hangul-palette-studio");
assert.equal(typeof manifest.provenance.studio.version, "string");
assert.match(manifest.provenance.studio.sourceSha256, /^[a-f0-9]{64}$/);
assert.equal(manifest.provenance.studio.sourceSha256, hash(JSON.stringify(manifest.provenance.studio.files)));

const ids = ["thin", "extra-light", "light", "regular", "medium", "semi-bold", "bold", "extra-bold", "black"];
const fontNames = ids.map((id) => `hangul-palette-${id}.woff2`);
assert.deepEqual((await readdir(resolve(root, "fonts"))).sort(), [...fontNames].sort());
assert.deepEqual(await readdir(resolve(root, "css")), ["hangul-palette.css"]);
assert.equal(manifest.weights.length, ids.length);
for (let index = 0; index < ids.length; index++) {
  const weight = manifest.weights[index];
  assert.equal(weight.id, ids[index]);
  assert.equal(weight.weight, (index + 1) * 100);
  assert.equal(weight.fontFile, `fonts/${fontNames[index]}`);
  assert.equal(weight.counts.characters, 11223);
  assert.equal((await read(weight.fontFile)).subarray(0, 4).toString(), "wOF2");
}
const expectedFiles = [...fontNames.map((name) => `fonts/${name}`), "css/hangul-palette.css", "metadata/validation.json", "LICENSE", "NOTICE"].sort();
assert.deepEqual(Object.keys(manifest.files).sort(), expectedFiles);
for (const [name, entry] of Object.entries(manifest.files)) {
  assert(!name.includes("..") && !name.startsWith("/") && !name.includes("\\"));
  assert(!(await lstat(resolve(root, name))).isSymbolicLink(), `Refuse symlink: ${name}`);
  const bytes = await read(name);
  assert.equal(bytes.length, entry.bytes, `Byte count: ${name}`);
  assert.equal(hash(bytes), entry.sha256, `SHA-256: ${name}`);
}
assert.equal(manifest.license.file, "LICENSE");
assert.equal(manifest.license.sha256, hash(await read("LICENSE")));
const validation = JSON.parse(await read("metadata/validation.json"));
assert.equal(validation.schemaVersion, 1);
assert.equal(validation.passed, true);
assert.deepEqual(Object.keys(validation.weights).sort(), [...ids].sort());
for (const weight of manifest.weights) {
  assert.equal(validation.weights[weight.id].passed, true);
  assert.equal(validation.weights[weight.id].fontSha256, manifest.files[weight.fontFile].sha256);
  const colorLayers = validation.weights[weight.id].colorLayers;
  assert.equal(colorLayers.colrVersion, 1);
  assert.equal(colorLayers.v0Glyphs, 11223);
  assert.equal(colorLayers.v1Glyphs, 11223);
  assert.equal(colorLayers.v0LayerRecords, validation.weights[weight.id].encodedCOLRLayers);
  assert.equal(colorLayers.v1LayerReferences, colorLayers.v0LayerRecords);
  assert(Number.isInteger(colorLayers.v1LayerRecords) && colorLayers.v1LayerRecords > 0);
  assert(colorLayers.v1LayerRecords <= colorLayers.v1LayerReferences);
  assert.equal(colorLayers.v0FallbackMatchesV1, true);
}
const css = (await read("css/hangul-palette.css")).toString();
const references = [...css.matchAll(/url\("([^"\n]+)"\)/g)].map((match) => match[1]);
assert.deepEqual(references, fontNames.map((name) => `../fonts/${name}`));
const baseClass = css.match(/\.hangul-palette\s*\{([^}]*)\}/)?.[1];
assert(baseClass, "Default font class must exist");
assert.match(baseClass, /font-palette\s*:\s*normal\s*;/);
assert.doesNotMatch(baseClass, /font-palette\s*:\s*--/);
const paletteNames = [...css.matchAll(/@font-palette-values\s+(--[\w-]+)\s*\{/g)].map((match) => match[1]);
assert.deepEqual(paletteNames, ["--hangul-palette", "--hangul-palette-gray", "--hangul-palette-roles"]);
const coloredClass = css.match(/\.hangul-palette--colored\s*\{([^}]*)\}/)?.[1];
assert(coloredClass, "Colored font class must exist");
assert.match(coloredClass, /font-palette\s*:\s*--hangul-palette\s*;/);
for (const slot of manifest.slots) assert(css.includes(`/* ${slot.index}: ${slot.id} — `), `Slot description: ${slot.id}`);

async function collectAssets(directory) {
  const files = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const name = `${directory}/${entry.name}`;
    assert(!entry.isSymbolicLink(), `Refuse website symlink: ${name}`);
    if (entry.isDirectory()) files.push(...await collectAssets(name));
    else {
      assert(entry.isFile(), `Expected website file: ${name}`);
      files.push(name);
    }
  }
  return files;
}

const pages = ["index.html", "glyphs.html"];
const assets = await collectAssets("assets");
const siteFiles = new Set([...pages, ...assets, ...Object.keys(manifest.files), "metadata/manifest.json"]);
const siteBase = new URL("https://example.invalid/hangul-palette/");
const pageSources = new Map(await Promise.all(pages.map(async (name) => [name, (await read(name)).toString()])));
// GitHub Pages and the local preview serve page.html at /page as well.
const pageRoutes = new Map(pages.map((name) => [name.replace(/\.html$/, ""), name]));
let checkedReferences = 0;
function checkReference(source, reference) {
  if (/^(?:https?:|mailto:|tel:|data:|blob:)/i.test(reference)) return;
  assert(!reference.startsWith("/"), `Use a relative website path: ${source} → ${reference}`);
  const target = new URL(reference, new URL(source, siteBase));
  assert(target.href.startsWith(siteBase.href), `Website path escapes project: ${source} → ${reference}`);
  const path = decodeURIComponent(target.pathname.slice(siteBase.pathname.length)) || "index.html";
  const name = pageRoutes.get(path) ?? path;
  assert(siteFiles.has(name), `Missing website file: ${source} → ${reference}`);
  if (target.hash && pageSources.has(name)) {
    const id = decodeURIComponent(target.hash.slice(1));
    assert([...pageSources.get(name).matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].some((match) => match[1] === id),
      `Missing website anchor: ${source} → ${reference}`);
  }
  checkedReferences++;
}
for (const [name, source] of pageSources) {
  assert(!(await lstat(resolve(root, name))).isSymbolicLink(), `Refuse website symlink: ${name}`);
  for (const match of source.matchAll(/\b(?:href|src)\s*=\s*["']([^"']*)["']/g)) checkReference(name, match[1]);
}
for (const name of ["css/hangul-palette.css", ...assets]) {
  if (!/\.(?:css|js)$/.test(name)) continue;
  const source = (await read(name)).toString();
  if (name.endsWith(".css")) {
    for (const match of source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) checkReference(name, match[1]);
  } else {
    execFileSync(process.execPath, ["--check", resolve(root, name)], { stdio: "pipe" });
    for (const match of source.matchAll(/\b(?:from\s*|import\s*)["']([^"']+)["']/g)) checkReference(name, match[1]);
  }
}
console.log(`Hangul Palette ${manifest.version}: 9 weights, 20 slots, ${Object.keys(manifest.files).length} file hashes and ${checkedReferences} website paths verified.`);
