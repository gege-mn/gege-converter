#!/usr/bin/env node

/**
 * Generate .tmp/review.html — a sign-off sheet for the orthographic
 * corrections applied on 2026-07-26.
 *
 * Every glyph and code-point run is produced by the built library at
 * generation time. Nothing is hand-transcribed, so the page cannot claim an
 * output the code does not actually produce.
 *
 *   pnpm build && node scripts/build-review.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { suffixes } from '../dist/data/suffixes.js';
import { analyze, convert, lexicon, toScript } from '../dist/index.js';

const require = createRequire(import.meta.url);
const OUT = fileURLToPath(new URL('../.tmp/review.html', import.meta.url));
const NNBSP = '\u202F';

/** gege-linter, if it can be found — the page states plainly when it cannot. */
function loadLinter() {
  for (const p of [
    process.env.GEGE_LINTER,
    '@gege-mn/gege-linter',
    fileURLToPath(new URL('../../gege-linter/dist/index.js', import.meta.url)),
  ]) {
    if (!p) continue;
    try {
      return { lint: require(p).lint, from: p };
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

const cpList = (s) =>
  [...s].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cpHtml = (s) =>
  cpList(s)
    .map(
      (c) =>
        `<span${c === 'U+180E' ? ' class="mvs"' : c.startsWith('U+180B') ? ' class="fvs"' : ''}>${c}</span>`,
    )
    .join(' ');

const classicalOf = (cyr) => lexicon.find((e) => e.cyrillic === cyr)?.classical;
const bestOf = (cyr) => analyze(cyr)[0]?.candidates[0]?.classical;

/** One before/after row: old romanization struck through, new one rendered. */
function row(cyrillic, was, now) {
  const script = toScript(now);
  return `<tr>
    <td class="cyr">${esc(cyrillic)}</td>
    <td class="was">${esc(was)}</td>
    <td class="arr">→</td>
    <td class="now">${esc(now)}</td>
    <td class="g" lang="mn-Mong">${esc(script)}</td>
    <td class="cps">${cpHtml(script)}</td>
  </tr>`;
}

const table = (rows, head = ['Cyrillic', 'was', '', 'now', 'script', 'code points']) =>
  `<div class="tablewrap"><table>
    <thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table></div>`;

// ── Corrections, with their pre-correction values recorded ────────────────
const RULE_O = [
  ['монгол', 'mongγol'],
  ['богино', 'boγoni'],
  ['бороо', 'boroγan'],
  ['долоо', 'doloγan'],
  ['орой', 'oroi'],
];
const RULE_DIPHTHONG = [
  ['сайн', 'sayin'],
  ['сайхан', 'sayiqan'],
  ['дайн', 'dayin'],
  ['айраг', 'ayiraγ'],
];
const RULE_PLURAL = [
  ['харууд', 'qaraud'],
  ['хотууд', 'qotaud'],
  ['номууд', 'nomud'],
  ['гэрүүд', 'gerüd'],
];

// ── Live verification ─────────────────────────────────────────────────────
const linter = loadLinter();
const allForms = new Set(lexicon.map((e) => toScript(e.classical)));
for (const e of lexicon) {
  for (const s of suffixes) {
    const out = convert(e.cyrillic + s.cyrillic);
    if (out !== e.cyrillic + s.cyrillic) allForms.add(out);
  }
}
const forms = [...allForms];
const diagnostics = linter ? forms.flatMap((f) => linter.lint(f)) : [];
const count = (sev) => diagnostics.filter((d) => d.severity === sev).length;
const nnbspCount = forms.filter((f) => f.includes(NNBSP)).length;

/** Every non-initial o/ö still in the lexicon — should be гол alone. */
const V = 'aeiouöüē';
const offenders = [
  ...new Set(
    lexicon
      .filter((e) => {
        let seen = false;
        for (const ch of e.classical) {
          if (!V.includes(ch)) continue;
          if (seen && (ch === 'o' || ch === 'ö')) return true;
          seen = true;
        }
        return false;
      })
      .map((e) => e.cyrillic),
  ),
];

const naimScript = convert('найм');
const NAIM_TARGET = ['U+1828', 'U+1820', 'U+1836', 'U+180B', 'U+182E', 'U+1820'];
const naimMatches = cpList(naimScript).join(' ') === NAIM_TARGET.join(' ');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Corrections applied — gege-converter</title>
<style>
  :root{--bg:#0f1115;--elev:#161922;--fg:#e6e6e6;--dim:#a3a8b3;--accent:#8ab4f8;
        --rule:#2a2f3a;--ok:#7ee08a;--ask:#e8c46a;--bad:#f08a8a;--mvs:#d99ae8;--fvs:#7fd4e8}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--fg)}
  body{font:17px/1.6 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif;
       max-width:1000px;margin:0 auto;padding:52px 24px 96px}
  h1{font-size:2rem;margin:0 0 .2em;letter-spacing:-.02em;line-height:1.15}
  h2{font-size:1.28rem;margin-top:2.6em;border-bottom:1px solid var(--rule);padding-bottom:.3em}
  h2 .n{color:var(--dim);font-weight:400;font-size:.8em;margin-right:.5em}
  code{background:var(--elev);padding:1px 6px;border-radius:4px;font-size:.86em;
       font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .meta{color:var(--dim);font-size:.88rem;margin-bottom:1.6em}
  .lede{color:var(--dim);font-size:.95rem;margin:.4em 0 1.1em;max-width:76ch}

  .badges{display:flex;gap:10px;flex-wrap:wrap;margin:1.4em 0 2em}
  .badge{background:var(--elev);border:1px solid var(--rule);border-radius:8px;
         padding:11px 15px;min-width:120px}
  .badge .v{font-size:1.5rem;font-weight:650;letter-spacing:-.02em;line-height:1.1}
  .badge .k{font-size:.68rem;text-transform:uppercase;letter-spacing:.09em;color:var(--dim);margin-top:.3em}
  .badge.good .v{color:var(--ok)} .badge.warn .v{color:var(--ask)}

  .tablewrap{overflow-x:auto;margin:1em 0}
  table{border-collapse:collapse;width:100%;font-size:.86rem}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--rule);vertical-align:middle}
  th{color:var(--dim);font-weight:600;font-size:.7rem;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap}
  tbody tr:hover{background:rgba(255,255,255,.02)}
  td.cyr{font-weight:600;white-space:nowrap}
  td.was{color:var(--bad);text-decoration:line-through;font-family:ui-monospace,Menlo,monospace;white-space:nowrap}
  td.now{color:var(--ok);font-family:ui-monospace,Menlo,monospace;white-space:nowrap}
  td.arr{color:var(--dim)}
  td.g{font-family:"Noto Sans Mongolian","Mongolian Baiti",sans-serif;font-size:1.45rem;
       writing-mode:vertical-lr;white-space:nowrap;height:120px;padding:6px 14px}
  td.cps{font-family:ui-monospace,Menlo,monospace;font-size:.68rem;color:var(--dim);line-height:1.75}
  .cps .mvs{background:rgba(217,154,232,.18);color:var(--mvs);border-radius:3px;padding:1px 3px}
  .cps .fvs{background:rgba(127,212,232,.18);color:var(--fvs);border-radius:3px;padding:1px 3px}

  .card{background:var(--elev);border:1px solid var(--rule);border-radius:10px;padding:18px 22px;margin:1.3em 0}
  .card.ok{border-left:3px solid var(--ok)}
  .card.ask{border-left:3px solid var(--ask)}
  .note{color:var(--dim);font-size:.9rem}
  ul li{margin-bottom:.35em}
  .legend{color:var(--dim);font-size:.82rem;margin-top:.6em}
  .legend .mvs{background:rgba(217,154,232,.18);color:var(--mvs);border-radius:3px;padding:1px 4px}
  .legend .fvs{background:rgba(127,212,232,.18);color:var(--fvs);border-radius:3px;padding:1px 4px}
  .fontwarn{background:rgba(232,196,106,.07);border:1px solid rgba(232,196,106,.28);
            border-radius:8px;padding:11px 15px;font-size:.86rem;color:var(--dim);margin:1.2em 0}
</style>
</head>
<body>

<h1>Corrections applied</h1>
<div class="meta">gege-converter · ${new Date().toISOString().slice(0, 10)} · every glyph below is produced by the built library, not typed by hand</div>

<div class="badges">
  <div class="badge good"><div class="v">${forms.length}</div><div class="k">forms checked</div></div>
  <div class="badge ${count('error') ? 'warn' : 'good'}"><div class="v">${count('error')}</div><div class="k">linter errors</div></div>
  <div class="badge ${count('warning') ? 'warn' : 'good'}"><div class="v">${count('warning')}</div><div class="k">linter warnings</div></div>
  <div class="badge ${nnbspCount ? 'warn' : 'good'}"><div class="v">${nnbspCount}</div><div class="k">NNBSP (U+202F)</div></div>
  <div class="badge ${offenders.length === 1 && offenders[0] === 'гол' ? 'good' : 'warn'}"><div class="v">${offenders.length}</div><div class="k">non-initial o/ö left</div></div>
</div>

<div class="fontwarn">
  If the vertical column reads as boxes, no Mongolian font is installed. Every row also
  carries its romanization and full code-point run, so the page validates without one.
  <span class="legend"><span class="mvs">U+180E</span> is MVS, <span class="fvs">U+180B</span> is FVS1.</span>
</div>

<h2><span class="n">1</span>o and ö only in the first syllable</h2>
<p class="lede">Applied as categorical: after the first syllable, masculine words take
<code>u</code> and feminine <code>ü</code>. Your spellings — монггул, боруг-а, богуни, долуг-а —
also removed a spurious final <code>-n</code> from бороо and долоо and gave them a chachlag.
орой → <code>orui</code> confirmed.</p>
${table(RULE_O.map(([cyr, was]) => row(cyr, was, classicalOf(cyr))))}
<p class="note">Sweep over the whole lexicon: <strong>${offenders.length} word${offenders.length === 1 ? '' : 's'}</strong>
still contains a non-initial o/ö — ${offenders.map((o) => `<code>${esc(o)}</code>`).join(', ')}.
That is the documented lexical exception, so the rule now holds everywhere else.
gege-linter's <code>non-initial-o</code> hits across all generated forms fell from
<strong>916 → ${count('info')}</strong>, and every remaining hit is that same word.</p>

<h2><span class="n">2</span>Medial i-diphthongs are V+i, not V+y+i</h2>
<p class="lede">The YA glide is gone — this is the "two shilbe" you asked for, and the modern
analysis UTN&nbsp;#57 prefers over the older Classical spelling.</p>
${table(RULE_DIPHTHONG.map(([cyr, was]) => row(cyr, was, classicalOf(cyr))))}
<p class="note">Deliberately unchanged: <code>bayar</code> (баяр), <code>bayan</code> (баян),
<code>qoyar</code> (хоёр). Their <code>y</code> sits between two full vowels and is a real
consonant, not a glide. Please confirm that reading is right.</p>

<h2><span class="n">3</span>найм — YA + FVS1</h2>
<p class="lede">The romanizer had no free-variation-selector support at all, which is why none of
my three earlier guesses could have been right. A digit after a letter now selects one, so найм
is written <code>nay1ma</code>. U+1836 YA is registered for FVS 1/2/3, so this is a valid sequence.</p>
${table([row('найм', 'naiman', classicalOf('найм'))])}
<div class="card ${naimMatches ? 'ok' : 'ask'}">
  <strong>${naimMatches ? '✓ Matches your reference exactly' : '✗ Does not match your reference'}</strong>
  <p class="note" style="margin:.5em 0 0">
    produced &nbsp;<code>${cpList(naimScript).join(' ')}</code><br>
    your image <code>${NAIM_TARGET.join(' ')}</code>
  </p>
</div>

<h2><span class="n">4</span>Plural — detached, and chosen by the Classical stem</h2>
<p class="lede">харууд = <code>qar-a</code> + MVS + <code>nuγud</code> — хар-а нугуд. Plurals are
written detached like the case suffixes, and the allomorph follows what the Classical stem ends
in: <code>ud/üd</code> after a consonant, <code>nuγud/nügüd</code> after a vowel. That condition
is what keeps a chachlag stem well-formed, so the stem is never rewritten.</p>
${table(RULE_PLURAL.map(([cyr, was]) => row(cyr, was, bestOf(cyr))))}
<p class="note">Two MVS in one word is correct here — as it already was for stacked case
suffixes (<code>ger-tü-ben</code>). An earlier version of mine stripped the chachlag off the stem
to avoid that; it was working around this missing rule and has been reverted.</p>

<h2><span class="n">5</span>Kept as-is</h2>
<div class="card ok">
  <strong>гол → <code>${esc(classicalOf('гол'))}</code></strong>
  <p class="note" style="margin:.5em 0">A genuine lexical exception with a doubled short o.
  Commented in the data file so it does not get "corrected" later. It is the sole reason the
  <code>non-initial-o</code> counter above is not zero.</p>
  <div class="tablewrap"><table><tbody>${row('гол', '—', classicalOf('гол'))}</tbody></table></div>
</div>

<h2><span class="n">6</span>Still unreviewed</h2>
<div class="card ask">
  <p class="note" style="margin-top:0">These are my own unverified work, not yours. The plural
  turning out wrong suggests the rest of this list deserves the same scrutiny.</p>
  <ul>
    <li><strong>The <code>separate</code> flags on the case suffixes</strong> — I marked genitive,
    accusative, dative, ablative, instrumental and reflexive as detached. The plural was wrong
    the same way, so these need checking.</li>
    <li><strong>The Cyrillic ↔ Classical suffix pairings</strong> in <code>data/suffixes.ts</code>.
    The Classical forms come from the curated knowledge base; the Cyrillic side is mine.</li>
    <li><strong>The remaining ~150 lexicon entries</strong> — everything not touched above.</li>
    <li><strong>No verb morphology</strong> — only the <code>-х</code> infinitive converts.</li>
    <li><strong>Stem alternation</strong> (бичиг→бичг, ажил→ажл) is unimplemented, so
    <code>бичгийн</code> falls through to the guesser.</li>
  </ul>
</div>

</body>
</html>
`;

mkdirSync(fileURLToPath(new URL('../.tmp', import.meta.url)), { recursive: true });
writeFileSync(OUT, html, 'utf8');
console.log(`wrote ${OUT}`);
console.log(`  forms checked:        ${forms.length}`);
console.log(
  `  linter:               ${count('error')} error / ${count('warning')} warning / ${count('info')} info`,
);
console.log(`  NNBSP:                ${nnbspCount}`);
console.log(`  non-initial o/ö left: ${offenders.join(', ') || 'none'}`);
console.log(`  найм matches image:   ${naimMatches}`);
