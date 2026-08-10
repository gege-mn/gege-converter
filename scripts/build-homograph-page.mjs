#!/usr/bin/env node
/**
 * Render the homographs discovered by the sentence harvest.
 *
 * A word is a homograph candidate when its SOLO rendering survives in some
 * sentences and not others. The shift rate is the discriminator:
 *
 *   0%   — Tungaamal always renders it the same way; no ambiguity
 *   100% — Tungaamal renders it differently in every sentence than it does alone.
 *          That is a systematic difference (a different default in running
 *          text), not context sensitivity, so it is listed separately.
 *   in between — genuinely context-dependent. This is the interesting set.
 *
 * Output is HTML with vertical bichig, because the terminal renders the script
 * with wrong glyphs and no vertical layout, so it cannot be judged there.
 *
 *   node scripts/build-homograph-page.mjs [out.html]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2] ?? '.tmp/homographs.html';
const SENTENCES = '.tmp/harvest-sentences.jsonl';
const SOLO = '.tmp/harvest-harvest.jsonl';

for (const f of [SENTENCES, SOLO]) {
  if (!existsSync(f)) {
    console.error(`missing ${f}`);
    process.exit(1);
  }
}

const solo = new Map();
for (const line of readFileSync(SOLO, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try {
    const r = JSON.parse(line);
    if (!r.cyrillic.includes(' ')) solo.set(r.cyrillic, r);
  } catch {
    // ignore
  }
}

const rows = [];
for (const line of readFileSync(SENTENCES, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try {
    rows.push(JSON.parse(line));
  } catch {
    // ignore
  }
}

/** Same folding the harvester used: orthographic variation is not a reading change. */
const normalize = (s) => s.replace(/\u202F/g, ' ').replace(/[\u180B-\u180D\u180F]/g, '');

const stat = new Map();
for (const row of rows) {
  for (const w of new Set(row.cyrillic.toLowerCase().split(' ').filter(Boolean))) {
    const entry = solo.get(w);
    if (!entry) continue;
    if (!stat.has(w)) stat.set(w, { hit: 0, miss: 0, hitEx: [], missEx: [] });
    const s = stat.get(w);
    if (normalize(row.raw).includes(normalize(entry.raw))) {
      s.hit += 1;
      if (s.hitEx.length < 2) s.hitEx.push(row);
    } else {
      s.miss += 1;
      if (s.missEx.length < 2) s.missEx.push(row);
    }
  }
}

const all = [...stat]
  .map(([w, s]) => ({ w, ...s, total: s.hit + s.miss, rate: s.miss / (s.hit + s.miss) }))
  .filter((a) => a.total >= 3);

const partial = all.filter((a) => a.rate > 0 && a.rate < 1).sort((a, b) => b.total - a.total);
const always = all.filter((a) => a.rate === 1).sort((a, b) => b.total - a.total);
const stable = all.filter((a) => a.rate === 0).length;

// --------------------------------------------------------------------- render

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const cpsOf = (s) =>
  [...s]
    .map((c) => {
      const p = c.codePointAt(0);
      if (p === 0x180e) return 'MVS';
      if (p === 0x202f) return 'NNBSP';
      if (p === 0x20) return 'SP';
      if (p >= 0x180b && p <= 0x180f) return `FVS${p - 0x180a}`;
      return `U+${p.toString(16).toUpperCase()}`;
    })
    .join(' ');

/** Highlight the target word inside a Cyrillic sentence. */
const markCyr = (sentence, word) =>
  sentence
    .split(' ')
    .map((t) => (t.toLowerCase() === word ? `<mark>${esc(t)}</mark>` : esc(t)))
    .join(' ');

const example = (row, word, kind) => `
  <div class="ex ${kind}">
    <div class="exhead">${kind === 'miss' ? 'context CHANGED it' : 'context left it alone'}</div>
    <div class="cyr">${markCyr(row.cyrillic, word)}</div>
    <div class="mn wide">${esc(row.unicode)}</div>
  </div>`;

const card = (a, idx) => {
  const s = solo.get(a.w);
  return `
<section class="card">
  <h3><span class="n">${idx + 1}</span> <span class="cy">${esc(a.w)}</span>
    <span class="rate ${a.rate > 0.6 ? 'hi' : a.rate > 0.25 ? 'mid' : 'lo'}">
      changed in ${a.miss} of ${a.total} sentences (${(a.rate * 100).toFixed(0)}%)</span></h3>
  <div class="split">
    <figure class="sbox">
      <div class="mn">${esc(s.raw)}</div>
      <figcaption>alone<br><code>${esc(cpsOf(s.raw))}</code></figcaption>
    </figure>
    <div class="exwrap">
      ${a.missEx.map((r) => example(r, a.w, 'miss')).join('')}
      ${a.hitEx
        .slice(0, 1)
        .map((r) => example(r, a.w, 'hit'))
        .join('')}
    </div>
  </div>
</section>`;
};

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Homographs discovered in ${rows.length} sentences</title>
<style>
 :root{--bg:#0f1115;--panel:#171a23;--fg:#e9eaee;--dim:#98a0ae;--rule:#2a3040;
       --accent:#8ab4f8;--ok:#5ec27a;--bad:#e5665f;--warn:#e0b341}
 *{box-sizing:border-box}
 body{margin:0 auto;background:var(--bg);color:var(--fg);max-width:1120px;padding:44px 20px 90px;
   font:16px/1.65 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif}
 h1{font-size:1.85rem;margin:0 0 .15em}
 h2{font-size:1.2rem;margin:2.4em 0 .5em;padding-bottom:.3em;border-bottom:1px solid var(--rule)}
 h3{font-size:1rem;margin:0 0 .9em;display:flex;align-items:center;gap:.7em;flex-wrap:wrap}
 .sub{color:var(--dim);margin:0 0 1.4em}
 .card{background:var(--panel);border-radius:11px;padding:18px 20px;margin:12px 0}
 .n{background:#243049;color:#9dbcf5;border-radius:6px;padding:2px 9px;font-size:.75rem;font-weight:700}
 .cy{color:#f0d68a;font-weight:700;font-size:1.15rem}
 .rate{font-size:.76rem;padding:2px 9px;border-radius:99px;font-weight:600}
 .rate.hi{background:#4a2b2b;color:#eda6a2}
 .rate.mid{background:#4a3f24;color:#e6c97a}
 .rate.lo{background:#243a2c;color:#96c8a8}
 code{background:#0b0d12;padding:1px 5px;border-radius:4px;font-size:.8em;color:#b9c6e0}
 mark{background:#5a4a12;color:#ffe9a3;padding:0 3px;border-radius:3px}

 .split{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
 .sbox{margin:0;background:#0c0e14;border:1px solid var(--rule);border-radius:9px;padding:14px 12px;
   display:flex;flex-direction:column;align-items:center;gap:10px;flex:none}
 .mn{writing-mode:vertical-lr;text-orientation:mixed;
   font-family:"Noto Sans Mongolian","Mongolian Baiti","MN Baiti","Menksoft Qagan",serif;
   font-size:2rem;line-height:1.5;min-height:120px;color:#fff}
 .mn.wide{min-height:0;max-height:340px;font-size:1.55rem}
 .sbox figcaption{font-size:.74rem;color:var(--dim);text-align:center;max-width:150px}
 .sbox figcaption code{display:inline-block;margin-top:5px;word-break:break-all;font-size:.66rem}

 .exwrap{flex:1;min-width:280px;display:flex;flex-direction:column;gap:10px}
 .ex{border-left:3px solid var(--rule);padding:9px 0 9px 13px;overflow-x:auto}
 .ex.miss{border-left-color:var(--bad)} .ex.hit{border-left-color:var(--ok)}
 .exhead{font-size:.7rem;text-transform:uppercase;letter-spacing:.07em;color:var(--dim);margin-bottom:5px}
 .cyr{font-size:.9rem;color:#cfd4de;margin-bottom:9px}

 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:1.2em 0}
 .stat{background:var(--panel);border-radius:9px;padding:14px 16px}
 .stat .lbl{color:var(--dim);font-size:.74rem;text-transform:uppercase;letter-spacing:.06em}
 .stat .big{font-size:1.9rem;font-weight:700;line-height:1.2}
 .note{background:var(--panel);border-left:3px solid var(--accent);border-radius:8px;padding:14px 18px;margin:1.2em 0}
 ul{padding-left:1.2em} li{margin:.3em 0}
 .chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:.6em}
 .chip{background:#1e2331;border:1px solid var(--rule);border-radius:99px;padding:3px 11px;font-size:.83rem}
</style></head><body>

<h1>Homographs found in running text</h1>
<p class="sub">${rows.length} sentences from the Eduge news corpus, ${stat.size} distinct words observed
against their solo renderings.</p>

<div class="grid">
  <div class="stat"><div class="lbl">stable</div><div class="big">${stable}</div>
    <div style="font-size:.78rem;color:var(--dim)">same in every context</div></div>
  <div class="stat"><div class="lbl">context-dependent</div><div class="big" style="color:var(--warn)">${partial.length}</div>
    <div style="font-size:.78rem;color:var(--dim)">changed in some contexts</div></div>
  <div class="stat"><div class="lbl">always different</div><div class="big" style="color:var(--dim)">${always.length}</div>
    <div style="font-size:.78rem;color:var(--dim)">systematic, not context</div></div>
</div>

<div class="note">
<p style="margin-top:0"><strong>How to read this.</strong> Each card shows a word's rendering
<em>alone</em> on the left, and sentences on the right — red where context changed it, green where it
did not. A word that changes in <em>some</em> contexts is a genuine homograph; one that changes in
<em>all</em> of them just has a different default in running text.</p>
<p style="margin-bottom:0">This is detection, not extraction. The tool says which words carry more
than one reading; it does not claim to know what the second reading is, because Tungaamal splits one
Cyrillic word into a variable number of bichig tokens and word-level alignment is unreliable.</p>
</div>

<h2>Context-dependent — ${partial.length} words</h2>
${partial.slice(0, 40).map(card).join('')}

<h2>Always different in running text — ${always.length} words</h2>
<p class="sub">Not homographs. Tungaamal simply picks another form once the word is in a sentence — worth a
look, since several are plural or case allomorph choices.</p>
<div class="chips">${always.map((a) => `<span class="chip">${esc(a.w)} <span style="color:var(--dim)">${a.total}</span></span>`).join('')}</div>

</body></html>
`;

writeFileSync(OUT, html);
console.log(`wrote ${OUT}`);
console.log(`  sentences:          ${rows.length}`);
console.log(`  stable:             ${stable}`);
console.log(`  context-dependent:  ${partial.length}`);
console.log(`  always different:   ${always.length}`);
