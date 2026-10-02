#!/usr/bin/env node
/**
 * Ask a bichig reader to rule on word pairs extracted by `align-sentences.mjs`
 * BEFORE any of them reach the training set.
 *
 * ## Why this gate exists
 *
 * The aligned pairs are real harvested data, not synthesis, and leave-one-out
 * over held-out anchors puts the alignment at 95.3%. But 95.3% is a measurement
 * of *alignment*, not of *correctness* — every pair is still the silver
 * converter's answer, and this project differs from it on documented points.
 * The failure mode to fear is the one from 2026-07-27: a whole class of rows
 * carrying one systematic error, invisible to aggregate accuracy because the
 * model reproduces it faithfully and confidently.
 *
 * A reader ruling on ~30 forms costs a minute and settles it. Terminal output
 * cannot be used to judge bichig, which is why this is an HTML page.
 *
 * ## Why the sample is stratified rather than random
 *
 * A random draw from 1,966 pairs would be ~two thirds nouns, and nouns are not
 * what this extraction is for. The sample is drawn per verb-ending group so
 * that a systematic error in any one group has a chance to show up — the
 * `-ж/-ч` and `-аад/-ээд` converbs especially, since `verb-suffixes.ts` records
 * them as unattested and these rows are the first evidence the project has.
 * A `control` group of non-verb forms is included so the reader is not primed
 * to expect only verbs.
 *
 *   node scripts/build-alignment-review.mjs [out.html] [--in f.jsonl] [--n 4]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const FLAGS_TAKING_A_VALUE = new Set(['--in', '--n']);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const positional = args.find(
  (a, i) => !a.startsWith('--') && !FLAGS_TAKING_A_VALUE.has(args[i - 1] ?? ''),
);
const OUT = positional ?? '.tmp/alignment-review.html';
const IN = flag('--in', '.tmp/aligned-words.jsonl');
const PER_GROUP = Number(flag('--n', 4));

if (!existsSync(IN)) {
  console.error(`missing ${IN} — run scripts/align-sentences.mjs first`);
  process.exit(1);
}

const { fromScript, toScript } = await import(
  pathToFileURL(resolve(ROOT, 'dist/romanize.js')).href
);

const pairs = [];
for (const line of readFileSync(IN, 'utf8').split('\n')) {
  if (!line.replace(/[ \n\r\t]/g, '')) continue;
  try {
    pairs.push(JSON.parse(line));
  } catch {
    // torn line
  }
}

/**
 * Deterministic PRNG, so re-running produces the same page and a reader's
 * verdicts stay addressable. Same generator as the training split.
 */
const mulberry32 = (a) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(20260727);
const sample = (arr, n) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};

/**
 * The endings this extraction exists to supply. `-ж/-ч` and `-аад/-ээд` lead
 * because `verb-suffixes.ts` has zero or near-zero attestations for them, so
 * these rows are the project's first evidence and carry the most risk.
 */
const GROUPS = [
  ['imperfective converb -ж/-ч', /[жч]$/, 'zero-to-thin attestation in verb-suffixes.ts'],
  ['perfective converb -аад/-ээд', /(аад|ээд|оод|өөд)$/, 'ZERO attestations — never before seen'],
  ['past participle -сан/-сэн', /(сан|сэн|сон|сөн)$/, 'reader-confirmed suffix, new stems'],
  ['habitual participle -даг/-дэг', /(даг|дэг|дог|дөг)$/, 'attested n=3..5 only'],
  ['present -на/-нэ', /(на|нэ|но|нө)$/, 'attested n=2, too thin to assert'],
  ['-лаа/-лээ', /(лаа|лээ|лоо|лөө)$/, 'mining says this is NOMINAL (l-iyan), not verbal'],
];

const used = new Set();
const groups = [];
for (const [title, re, why] of GROUPS) {
  const pool = pairs.filter((p) => re.test(p.cyrillic) && !used.has(p.cyrillic));
  const picked = sample(pool, PER_GROUP);
  for (const p of picked) used.add(p.cyrillic);
  groups.push({ title, why, items: picked, total: pool.length });
}
const controlPool = pairs.filter(
  (p) => !used.has(p.cyrillic) && !GROUPS.some(([, re]) => re.test(p.cyrillic)),
);
groups.push({
  title: 'control — non-verb forms',
  why: 'so the sample is not all verbs and priming is visible',
  items: sample(controlPool, PER_GROUP),
  total: controlPool.length,
});

const codePoints = (s) =>
  [...s].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');

/** Romanization is a debugging aid here, and may legitimately be unavailable. */
const romanize = (script) => {
  try {
    const r = fromScript(script);
    return toScript(r) === script ? r : `${r} (does not round-trip)`;
  } catch (e) {
    return `— ${e.message}`;
  }
};

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cards = groups
  .map(
    (g) => `<section>
  <h2>${esc(g.title)} <span class="n">${g.items.length} of ${g.total}</span></h2>
  <p class="why">${esc(g.why)}</p>
  <div class="grid">
  ${g.items
    .map(
      (p, i) => `<figure class="card" data-w="${esc(p.cyrillic)}">
      <div class="cyr">${esc(p.cyrillic)}</div>
      <div class="mn">${esc(p.script)}</div>
      <div class="rom">${esc(romanize(p.script))}</div>
      <div class="cp">${esc(codePoints(p.script))}</div>
      <div class="btns">
        <button class="ok"   data-v="ok">correct</button>
        <button class="bad"  data-v="wrong">wrong</button>
        <button class="hm"   data-v="unsure">unsure</button>
      </div>
      <input class="fix" placeholder="correct form, if you have it" data-i="${i}">
    </figure>`,
    )
    .join('\n')}
  </div>
</section>`,
  )
  .join('\n');

const html = `<!doctype html><meta charset="utf-8">
<title>Alignment review — extracted word pairs</title>
<style>
:root{--bg:#faf9f7;--fg:#1b1a18;--mut:#6b665e;--line:#ddd8d0;--ok:#1c7a4a;--bad:#b3261e;--hm:#8a6d1f}
@media (prefers-color-scheme:dark){:root{--bg:#16151a;--fg:#eceaf0;--mut:#9a94a5;--line:#33313b}}
*{box-sizing:border-box}
body{margin:0;padding:28px;background:var(--bg);color:var(--fg);
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.5}
h1{font-size:1.35rem;margin:0 0 6px}
.lede{color:var(--mut);max-width:62ch;margin:0 0 26px;font-size:.94rem}
h2{font-size:1rem;margin:30px 0 2px;font-weight:650}
.n{color:var(--mut);font-weight:400;font-size:.82rem}
.why{color:var(--mut);font-size:.83rem;margin:0 0 12px}
.grid{display:flex;flex-wrap:wrap;gap:14px}
.card{margin:0;border:1px solid var(--line);border-radius:11px;padding:13px;
  background:color-mix(in srgb,var(--bg) 88%,var(--fg) 4%);width:190px;display:flex;flex-direction:column;gap:9px}
.card[data-verdict=ok]{border-color:var(--ok);box-shadow:inset 0 0 0 1px var(--ok)}
.card[data-verdict=wrong]{border-color:var(--bad);box-shadow:inset 0 0 0 1px var(--bad)}
.card[data-verdict=unsure]{border-color:var(--hm);box-shadow:inset 0 0 0 1px var(--hm)}
.cyr{font-size:1.06rem;font-weight:600}
.mn{writing-mode:vertical-lr;text-orientation:mixed;
  font-family:"Noto Sans Mongolian","Mongolian Baiti","MN Baiti","Menksoft Qagan",serif;
  font-size:1.9rem;height:200px;align-self:center;line-height:1.35}
.rom{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.76rem;color:var(--mut);word-break:break-all}
.cp{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.63rem;color:var(--mut);word-break:break-all;line-height:1.35}
.btns{display:flex;gap:5px}
button{flex:1;border:1px solid var(--line);border-radius:7px;background:transparent;color:var(--fg);
  padding:5px 2px;cursor:pointer;font-size:.72rem;font-family:inherit}
button:hover{border-color:var(--fg)}
.card[data-verdict=ok] .ok{background:var(--ok);color:#fff;border-color:var(--ok)}
.card[data-verdict=wrong] .bad{background:var(--bad);color:#fff;border-color:var(--bad)}
.card[data-verdict=unsure] .hm{background:var(--hm);color:#fff;border-color:var(--hm)}
.fix{border:1px solid var(--line);border-radius:7px;background:transparent;color:var(--fg);
  padding:5px 7px;font-size:.74rem;font-family:inherit;width:100%}
#out{position:sticky;bottom:0;margin-top:34px;border:1px solid var(--line);border-radius:11px;
  padding:13px;background:var(--bg)}
textarea{width:100%;height:150px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:.76rem;border:1px solid var(--line);border-radius:8px;background:transparent;
  color:var(--fg);padding:9px;white-space:pre;overflow:auto}
</style>
<h1>Do these belong in the training set?</h1>
<p class="lede">These word pairs were pulled out of the 4,000 parallel <b>sentences</b> — running
text, which is why they contain inflected verbs the word-level harvest never had. Alignment is
measured at 95.3%, but that measures alignment, not correctness: every pair is still the silver
converter's answer. <b>Nothing here has been trained on yet.</b> Rule on what you can, skip what you
can't, then paste the block at the bottom back to me. Script is vertical in a real Mongolian font;
code points sit underneath for byte-checking.</p>
${cards}
<div id="out"><b>Verdicts</b> — paste this back:<br><textarea id="ta" readonly></textarea></div>
<script>
const ta=document.getElementById('ta');
function dump(){
  const lines=[];
  for(const c of document.querySelectorAll('.card')){
    const v=c.dataset.verdict; if(!v) continue;
    const fix=c.querySelector('.fix').value.trim();
    lines.push(c.dataset.w+'  '+v+(fix?'  → '+fix:''));
  }
  ta.value=lines.length?lines.join('\\n'):'(nothing marked yet)';
}
for(const b of document.querySelectorAll('button')){
  b.onclick=()=>{const c=b.closest('.card');
    c.dataset.verdict = c.dataset.verdict===b.dataset.v ? '' : b.dataset.v; dump();};
}
for(const i of document.querySelectorAll('.fix')) i.oninput=dump;
dump();
</script>
`;

writeFileSync(OUT, html);
const total = groups.reduce((n, g) => n + g.items.length, 0);
console.log(`${total} forms across ${groups.length} groups → ${OUT}`);
for (const g of groups) console.log(`  ${g.title.padEnd(32)} ${g.items.length} of ${g.total}`);
