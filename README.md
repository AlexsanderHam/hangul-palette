# Hangul Palette

A Hangul color webfont with customizable component and stroke colors, based on Pretendard.

[Playground](https://alexsanderham.github.io/hangul-palette/) · [Glyph browser](https://alexsanderham.github.io/hangul-palette/glyphs)

- Nine static weights: Thin 100 through Black 900, in steps of 100.
- The official font's original glyph data, character mapping and metrics retained in each weight.
- 11,172 modern Hangul syllables and 51 compatibility jamo with twenty color slots, controlled through CSS.
- Latin letters, digits and punctuation use ordinary CSS text color.
- WOFF2 with CFF outlines, COLR v1 paints, COLR v0 fallback layers for Safari, and CPAL v0.

## Usage

Copy `fonts/` and `css/` into your web project, keeping their relative locations. The stylesheet loads fonts from `../fonts/`.

```html
<link rel="stylesheet" href="./css/hangul-palette.css">

<p class="hangul-palette">한글 팔레트</p>
<p class="hangul-palette hangul-palette--colored" style="font-weight:700">
  한글 팔레트
</p>
```

The first paragraph uses the default black Hangul palette. The second uses the included color palette and Bold 700. Set `font-weight` from `100` to `900` in steps of 100 to choose a weight.

## Custom colors

Define a palette after loading the supplied stylesheet:

```css
@font-palette-values --my-hangul {
  font-family: "Hangul Palette";
  base-palette: 0;
  override-colors: 0 #f97373, 3 #2563eb;
}

.my-hangul {
  font-palette: --my-hangul;
}
```

Apply it with `class="hangul-palette my-hangul"`. This colors the body of the first initial component and the vertical stroke of the first medial component; other slots stay black. See [the stylesheet](css/hangul-palette.css) for all twenty slot indices and example palettes.

Use `font-palette` to change Hangul component colors. CSS `color` does not override those palette entries; use it for Latin letters, digits and punctuation. Changing either does not require rebuilding the font.

Each weight retains the official font's 14,716 original glyphs and 14,336 mapped characters. Its 51 halfwidth Hangul aliases share their corresponding jamo colors. Characters outside the original coverage use CSS fallback fonts. Hangul color layers are clipped to the official filled outlines, with overlapping stroke junctions designed for opaque colors. Browser antialiasing can differ from the original monochrome font even when its glyph data and metrics are preserved.

## Website

The [playground](https://alexsanderham.github.io/hangul-palette/) lets you edit text, compare nine weights and choose colors with pickers or HEX values. You can adjust all twenty Hangul slots and the ordinary text color for Latin letters, digits and punctuation. The [glyph browser](https://alexsanderham.github.io/hangul-palette/glyphs) covers all 11,223 colored characters, with search, component filters and enlarged weight comparisons.

**Font + CSS** downloads a ZIP with all nine fonts, a stylesheet containing your selected colors and weight, a preview, and license notices. Apply the generated class with that stylesheet:

```html
<link rel="stylesheet" href="./css/hangul-palette.css">
<p class="hangul-palette hangul-palette--custom">한글 팔레트</p>
```

**CSS only** downloads the same configured stylesheet for use with an existing `fonts/` directory. **Copy CSS** copies just the custom palette and class rules to add after the base stylesheet. Colors stay in CSS; the font files keep their default black palette.

### Local preview

From the repository root, start a static server with Node.js 24.x (24.22.1 or newer):

```sh
npx --yes serve . --listen 4012
```

- [Local playground](http://localhost:4012/)
- [Local glyph browser](http://localhost:4012/glyphs)

The website needs no build step, external libraries or CDNs. Use a browser that supports COLR/CPAL and CSS `font-palette`.

## Files

| Path | Contents |
| --- | --- |
| `fonts/` | Nine WOFF2 fonts |
| `css/hangul-palette.css` | Font declarations, palettes and slot descriptions |
| `index.html`, `glyphs.html` | Palette playground and glyph browser |
| `assets/` | Website styles and JavaScript |
| `metadata/manifest.json` | Version, file hashes, palette slots and build provenance |
| `metadata/validation.json` | Font structure, outline and junction validation results |
| `scripts/verify.mjs` | Distribution and website checks |

Paths in the manifest are relative to the repository root.

## Repository checks

From the repository root, verify font hashes, weights, website paths and JavaScript syntax with Node.js 24.x (24.22.1 or newer):

```sh
node scripts/verify.mjs
```

This checks the repository's original distribution files. Website downloads contain customized CSS and do not include the repository verification tools or manifest.

Source data, editing tools and the font compiler live in the separate [**hangul-palette-studio**](https://github.com/AlexsanderHam/hangul-palette-studio) repository. Its README covers editing and release generation.

## GitHub Pages

Select **GitHub Actions** under the repository's **Settings → Pages → Build and deployment → Source**. The [workflow](.github/workflows/check.yml) verifies every push and pull request, then deploys successful pushes to `main`. It can also be run manually on `main`. Only the public pages, assets, fonts, stylesheet, metadata and license notices are deployed.

## License and credits

The fonts are distributed under the [SIL Open Font License 1.1](LICENSE). Keep [LICENSE](LICENSE) and [NOTICE](NOTICE) with redistributed fonts.

Based on [Pretendard v1.3.9](https://github.com/orioncactus/pretendard/tree/v1.3.9) by Kil Hyung-jin. Hangul Palette is an independent derivative maintained by Alexsander Ham.
