/**
 * The gege house style, for the HTML review pages.
 *
 * ## Why this exists
 *
 * Every page in `scripts/build-*.mjs` had grown its own dark palette and its
 * own `font-family` guess. That was fine while the pages were scratch output,
 * and stopped being fine once the review loop became "the only working review
 * channel" (CLAUDE.md): a reader judging bichig should be looking at the same
 * shapes, on the same paper, as the product itself.
 *
 * Tokens are copied from `~/Projects/gege.mn/src/routes/layout.css` — the
 * Kinetic Paper palette and the four faces. Copied rather than imported
 * because these scripts must run in this repo with no cross-project resolution,
 * and a stale colour is a cosmetic bug where a stale *font* would be a
 * correctness one. Which is why the font is not copied but embedded, below.
 *
 * ## The font is embedded, and that is the point
 *
 * The pages used to ask for `"Noto Sans Mongolian", "Mongolian Baiti", …` and
 * hope. That silently makes the reader's verdict depend on which font their
 * machine happens to have, and the fonts disagree: Android ships none, Apple's
 * has been broken, and both have been Unicode-divergent (gege.mn's
 * `static/fonts/README.md` §Noto Sans Mongolian). A page that renders in a
 * different font than the product is a page that can produce a *wrong verdict*
 * — the reader marks a word bad that we spell correctly, or good that we do
 * not.
 *
 * So the same version-pinned woff2 the site serves is inlined as a data URI.
 * The page stays a single self-contained file, and what it shows is what
 * gege.mn shows.
 *
 * ## The face, named and pinned
 *
 * **Noto Sans Mongolian 3.100** — SIL Open Font License 1.1, from
 * `github.com/notofonts/mongolian`, the `hinted` build with all Mongolian GSUB
 * lookups kept (`fina init isol medi rclt vert`, the modern UTN #57 contextual
 * model). Read off the binary's `name` table, not off a README: `uniqueID` is
 * `3.100;GOOG;NotoSansMongolian-Regular` and `head` carries fontRevision 3.100.
 *
 * ⚠ **Every rendering verdict in this project is a verdict at this version.**
 * Upstream Noto has changed Mongolian shaping between releases, so a reader
 * ruling recorded against 3.100 is not automatically a ruling against 3.101.
 * If the face is ever updated, re-render the corpus and diff the glyph
 * sequences before trusting any prior verdict (done for 3.002 → 3.100 on
 * 2026-10-02: every bichig run in this repo kept its letterforms; only
 * spacing and drawing moved) — the pin is what makes
 * `test/rulings.test.ts` mean the same thing next year as it did the day each
 * row was confirmed.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

/** Kinetic Paper — gege.mn's palette. */
export const PALETTE = {
  paper: '#f5f2ea',
  ink: '#14110d',
  acc: '#6d28d9',
  dim: '#8a8478',
  /** Panel and rule tones, derived here because the site gets them from Tailwind. */
  panel: '#fffdf8',
  rule: '#e0dacb',
};

/**
 * The gege "Notch" mark — a squircle with a quarter-circle bite out of the
 * top-right, matching `src/lib/Logo.svelte`. `currentColor` so it inherits.
 */
export const LOGO_SVG = `<svg class="logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="gege"><mask id="gege-notch"><rect x="8" y="8" width="84" height="84" rx="24.15" fill="#fff"/><circle cx="92" cy="8" r="34.65" fill="#000"/></mask><rect x="8" y="8" width="84" height="84" rx="24.15" fill="currentColor" mask="url(#gege-notch)"/></svg>`;

/**
 * The bichig face every rendering verdict in this project is a verdict at.
 *
 * Single-sourced because it was a prose literal in two places and is the kind
 * of fact that goes stale silently: the page would keep claiming an old version after
 * someone dropped a newer woff2 into the sibling checkout. `version` is what
 * the binary's `name` table reports, so update it only alongside the file.
 */
export const MONGOL_FONT = {
  name: 'Noto Sans Mongolian',
  version: '3.100',
  uniqueId: '3.100;GOOG;NotoSansMongolian-Regular',
  license: 'SIL Open Font License 1.1',
  copyright: 'Copyright 2023 The Noto Project Authors',
  source: 'https://github.com/notofonts/mongolian',
};

const FONT_PATH = resolve(homedir(), 'Projects/gege.mn/static/fonts/noto-sans-mongolian.woff2');

/**
 * `@font-face` for the bichig face, with the woff2 inlined.
 *
 * Falls back to naming installed faces when the sibling checkout is absent, so
 * a page still builds — but says so on the page, because a reader needs to know
 * their verdict may be font-dependent.
 */
export function mongolFontFace() {
  if (!existsSync(FONT_PATH)) {
    return {
      css: '',
      stack: '"Noto Sans Mongolian","Mongolian Baiti","MN Baiti","Menksoft Qagan",serif',
      embedded: false,
    };
  }
  const b64 = readFileSync(FONT_PATH).toString('base64');
  return {
    css: `@font-face{font-family:"Gege Mongol";src:url(data:font/woff2;base64,${b64}) format("woff2");font-display:block;font-weight:400}`,
    stack: '"Gege Mongol","Noto Sans Mongolian","Mongolian Baiti",serif',
    embedded: true,
  };
}

/**
 * Base stylesheet shared by every review page: palette, the embedded face, the
 * logo block, and the vertical bichig frame.
 *
 * Bichig is `writing-mode: vertical-lr`, which is not decoration — Hudum is
 * written top-to-bottom and a horizontally-laid-out sample is not the shape
 * anyone reads.
 */
export function baseCss() {
  const font = mongolFontFace();
  return `${font.css}
:root{--paper:${PALETTE.paper};--ink:${PALETTE.ink};--acc:${PALETTE.acc};--dim:${PALETTE.dim};
  --panel:${PALETTE.panel};--rule:${PALETTE.rule};
  --font-mono:"Space Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --font-mark:"Space Grotesk","Helvetica Neue",sans-serif;
  --font-mongol:${font.stack}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--font-mono);
  padding:0 22px 130px;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
::selection{background:color-mix(in srgb,var(--acc) 25%,transparent)}
.wrap{max-width:940px;margin:0 auto}
header.brand{display:flex;align-items:center;gap:12px;padding:26px 0 8px;border-bottom:1px solid var(--rule);margin-bottom:26px}
header.brand .logo{width:30px;height:30px;color:var(--acc);flex:none}
header.brand .who{font-family:var(--font-mark);font-weight:700;letter-spacing:-.01em;font-size:1.02rem}
header.brand .who span{color:var(--dim);font-weight:400}
h1{font-family:var(--font-mark);font-weight:700;letter-spacing:-.02em;margin:.2em 0 .3em;font-size:1.5rem}
.intro{color:var(--dim);line-height:1.62;max-width:66ch;font-size:.92rem}
.card{background:var(--panel);border:1px solid var(--rule);border-radius:12px;padding:20px 22px;margin:14px 0}
code{background:color-mix(in srgb,var(--ink) 6%,transparent);padding:1px 6px;border-radius:4px;
  font-size:.85em}
.bichig{font-family:var(--font-mongol);writing-mode:vertical-lr;text-orientation:sideways;
  font-size:33px;line-height:1.5;white-space:nowrap}
.cps{font-size:.68rem;color:var(--dim);word-break:break-all;line-height:1.5}
.fontwarn{background:#fff4e5;border:1px solid #f0c893;color:#7a4a08;border-radius:9px;
  padding:10px 13px;font-size:.84rem;margin:14px 0}
footer.brand{margin-top:40px;padding-top:16px;border-top:1px solid var(--rule);
  color:var(--dim);font-size:.75rem;line-height:1.6}`;
}

/** The masthead every page opens with. */
export function header(subtitle) {
  return `<header class="brand">${LOGO_SVG}<div class="who">gege<span> · ${subtitle}</span></div></header>`;
}

/** Licence notice — SIL OFL 1.1 requires it to travel with the embedded font. */
export function footer() {
  const font = mongolFontFace();
  const { name, version, copyright, license } = MONGOL_FONT;
  return `<footer class="brand">Bichig set in ${name} v${version} — ${copyright}, ${license}. ${
    font.embedded
      ? 'Embedded in this page, so it renders identically to gege.mn.'
      : '<strong>Not embedded</strong> — this page fell back to your system fonts.'
  }</footer>`;
}

/** Banner shown when the font could not be embedded; empty when it could. */
export function fontWarning() {
  if (mongolFontFace().embedded) return '';
  return `<div class="fontwarn"><strong>Font not embedded.</strong> This page is using whatever
Mongolian font your machine has, which may shape differently from what we ship — so a
verdict here may not be a verdict on our output. Rebuild with ~/Projects/gege.mn present.</div>`;
}
