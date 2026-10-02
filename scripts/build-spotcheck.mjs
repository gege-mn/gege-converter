#!/usr/bin/env node
/**
 * Build an interactive spot-check page for a human reviewer.
 *
 * Meant to be re-run periodically, not once: after any change that touches the
 * suffix table, the guesser or the lexicon, this samples what the converter now
 * produces and asks a bichig reader to rule on it. Selections collect into one
 * copy-pasteable block at the bottom.
 *
 * Bichig is rendered vertically in a real Mongolian font, because the terminal
 * shows wrong glyphs and no vertical layout — a reader cannot judge correctness
 * from terminal output. Code points sit under each rendering for byte-checking.
 *
 * Three sample groups, each answering a different question:
 *
 *   changed     what a specific edit altered      (needs --changed)
 *   suspicious  where the converter is least sure — invented stems, narrow
 *               wins, and disagreements with the silver
 *   random      unbiased draw, to catch what the heuristics miss
 *
 *   node scripts/build-spotcheck.mjs [out.html] [--changed f.json] [--n 8]
 *   node scripts/build-spotcheck.mjs [out.html] --disagreements [--n 25]
 *
 * `--disagreements` replaces the three groups with one: the commonest words
 * where our LETTERS differ from the silver's, and nothing else. It is the
 * page for a reader with twenty minutes — every card is a real difference,
 * and the ones already settled or already asked are left off (see
 * `unexplained` below).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { baseCss, fontWarning, footer, header } from './lib/brand.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const FLAGS_TAKING_A_VALUE = new Set(['--changed', '--n']);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
/** First bare argument — one that is neither a flag nor a flag's value. */
const positional = args.find(
  (a, i) => !a.startsWith('--') && !FLAGS_TAKING_A_VALUE.has(args[i - 1] ?? ''),
);
const OUT = positional ?? '.tmp/spotcheck.html';
const CHANGED = flag('--changed', null);
const DISAGREEMENTS = args.includes('--disagreements');
const PER_GROUP = Number(flag('--n', DISAGREEMENTS ? 25 : 8));

const { analyze } = await import(pathToFileURL(resolve(ROOT, 'dist/index.js')).href);
const { toScript } = await import(pathToFileURL(resolve(ROOT, 'dist/romanize.js')).href);
const { scriptOf } = await import(pathToFileURL(resolve(ROOT, 'scripts/lib/silver.mjs')).href);
const { suffixes } = await import(pathToFileURL(resolve(ROOT, 'dist/data/suffixes.js')).href);
const { verbSuffixes } = await import(
  pathToFileURL(resolve(ROOT, 'dist/data/verb-suffixes.js')).href
);

// ------------------------------------------------------------- silver answers

/**
 * cyrillic → the silver's answer, in THIS project's orthography, for
 * cross-checking what we produce.
 *
 * Normalised through `scriptOf`, as every importer reads it. The page used to
 * show the raw repaired form, and a reader then spent a third of a sitting on
 * differences that are not differences: a name whose second half keeps its о
 * where we fold it to у ("visually looks identical"), which the normaliser
 * exists to remove.
 */
const silverAnswers = new Map();
/** How often each silver word occurs in the corpus its list came from. */
const frequency = new Map();
for (const file of ['.tmp/harvest-harvest.jsonl', '.tmp/spot.jsonl']) {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r.unicode) silverAnswers.set(r.cyrillic, scriptOf(r));
      if (typeof r.freq === 'number') frequency.set(r.cyrillic, r.freq);
    } catch {
      // torn line
    }
  }
}

// ------------------------------------------------------------------- corpus

const corpus = resolve(ROOT, '.tmp/harvest-sentences.jsonl');
const words = new Set();
if (existsSync(corpus)) {
  for (const line of readFileSync(corpus, 'utf8').split('\n').slice(0, 3000)) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const text = row.cyrillic ?? row.text ?? '';
    if (!text) continue;
    for (const a of analyze(text)) {
      if (a.token.kind === 'word' && a.token.text.length > 2) words.add(a.token.text.toLowerCase());
    }
  }
}
const vocabulary = [...words];

// --------------------------------------------------------------- assessment

const cps = (s) =>
  [...s].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');

/** Connectors out: MVS against a fused suffix is house style, not a disagreement. */
const letters = (script) => script.replace(/\u180E/g, '');

/** Everything the page needs to show one word, plus why it was picked. */
function assess(word) {
  const tokens = analyze(word);
  const [token] = tokens;
  const best = token?.candidates[0];
  if (best === undefined) return null;
  const runnerUp = token.candidates[1];
  const theirs = silverAnswers.get(word);
  // The WHOLE word as we write it. One Cyrillic word can be two bichig words
  // (чадахгүй is `čidaqu ügei`), and showing only the first made the page ask
  // a reader about a word with its second half missing.
  const script = tokens.map((t) => t.candidates[0]?.script ?? t.token.text).join('');
  const classical = tokens.map((t) => t.candidates[0]?.classical ?? t.token.text).join('');
  // Letters, not code points: -тай attached or detached is a choice a reader
  // has ruled both ways correct, and it is not what the page is asking about.
  let agree = null;
  if (theirs !== undefined) agree = letters(theirs) === letters(script);
  return {
    word,
    classical,
    script,
    provenance: best.provenance,
    confidence: best.confidence,
    margin: runnerUp === undefined ? 1 : best.confidence - runnerUp.confidence,
    chain: best.segmentation.suffixes.map((s) => s.category).join(' + ') || '(bare stem)',
    depth: best.segmentation.suffixes.length,
    stem: best.segmentation.stem,
    theirs,
    agree,
  };
}

/**
 * Suspicion score. Higher means "a reviewer's time is better spent here".
 * Disagreement with the silver outranks everything, because that is the only signal
 * here that comes from outside this codebase.
 */
function suspicion(a) {
  let score = 0;
  if (a.agree === false) score += 10;
  if (a.provenance === 'guess') score += 6;
  if (a.margin < 0.15) score += 3;
  // A deep chain is more ways to be wrong, and stacks are where the newly
  // added contracted allomorphs are most likely to have over-matched.
  if (a.depth > 2) score += 1;
  return score;
}

const pick = (pool, n, exclude) => {
  const out = [];
  const seen = new Set(exclude);
  const bag = [...pool];
  while (out.length < n && bag.length > 0) {
    const i = Math.floor(Math.random() * bag.length);
    const [w] = bag.splice(i, 1);
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
};

const groups = [];
const used = new Set();

/**
 * Disagreements a reader has not already dealt with.
 *
 * Left off, each for a reason that would otherwise cost the reader a card:
 * - a word a ruling already answers (`same(...)` in the rulings) — settled;
 * - a held-out word — withheld from the tier on purpose, so nothing they say
 *   about it can be applied without spoiling the measurement;
 * - an abbreviation (the silver spells it with joiners and commas) and the
 *   plural after н (`-ud` against `-nuγud`) and a word that differs only by a
 *   final н (ам `aman` / `ama`) — three open QUESTIONS, each asked once as a
 *   question rather than a hundred times as cards;
 * - a difference of selectors only (дээ `de` against `d1e`) — one question
 *   about how a particle's first letter is drawn, not a card per particle;
 * - a fragment: one or two letters, or a bare suffix (ийн, аас, наас), which
 *   the word list holds because text writes them after a hyphen.
 */
function unexplained() {
  const read = (file) =>
    existsSync(resolve(ROOT, file)) ? readFileSync(resolve(ROOT, file), 'utf8') : '';
  const ruled = new Set(
    [...read('test/rulings.test.ts').matchAll(/same\(\s*'([а-яөүё]+)'/g)].map((m) => m[1]),
  );
  const heldOut = new Set(
    (JSON.parse(read('test/fixtures/attested-heldout.json') || '{"entries":[]}').entries ?? []).map(
      (e) => e.cyrillic,
    ),
  );
  const lettersOnly = /^(?:[\u1820-\u1842]|[\u180B-\u180F]| )+$/;
  const plain = (script) => script.replace(/[\u180B-\u180D\u180F]/g, '');
  const endings = new Set([...suffixes, ...verbSuffixes].map((row) => row.cyrillic));
  const fragment = (word) =>
    /^[ыьъ]/.test(word) ||
    endings.has(word) ||
    (word.startsWith('н') && endings.has(word.slice(1)));
  const N = '\u1828';
  const out = [];
  for (const [word, theirs] of silverAnswers) {
    if (word.length <= 2 || fragment(word) || ruled.has(word) || heldOut.has(word)) continue;
    if (!lettersOnly.test(theirs)) continue;
    const a = assess(word);
    if (a === null || a.agree !== false) continue;
    const ours = letters(a.script);
    const ref = letters(theirs);
    if (ours === ref + N || ref === ours + N || plain(ours) === plain(ref)) continue;
    if (
      /н(ууд|үүд)/.test(word) &&
      /\u1828\u1824\u182D\u1824\u1833|\u1828\u1826\u182D\u1826\u1833/.test(ref)
    ) {
      continue;
    }
    out.push({ ...a, freq: frequency.get(word) ?? 0 });
  }
  return out.sort((x, y) => y.freq - x.freq);
}

if (DISAGREEMENTS) {
  const all = unexplained();
  groups.push({
    key: 'D',
    title: 'Where we and the silver disagree',
    blurb: `The ${Math.min(PER_GROUP, all.length)} commonest of ${all.length} words whose letters differ from the silver's, most frequent first. Settled words, held-out words, abbreviations and the plural after н are left off.`,
    items: all.slice(0, PER_GROUP),
  });
}

if (!DISAGREEMENTS && CHANGED !== null && existsSync(CHANGED)) {
  const rows = JSON.parse(readFileSync(CHANGED, 'utf8'));
  const chosen = pick(
    rows.map((r) => r.w),
    PER_GROUP,
    used,
  );
  const before = new Map(rows.map((r) => [r.w, r.from]));
  const items = chosen.map((w) => ({ ...assess(w), before: before.get(w) })).filter((a) => a.word);
  for (const it of items) used.add(it.word);
  groups.push({
    key: 'C',
    title: 'Changed by this edit',
    blurb:
      'These words convert differently than they did before the change. The previous answer is shown beside the new one — if the old one was right, that is a regression I need to know about.',
    items,
  });
}

const scored = (DISAGREEMENTS ? [] : vocabulary)
  .map(assess)
  .filter(Boolean)
  .map((a) => ({ a, s: suspicion(a) }))
  .filter((x) => x.s > 0 && !used.has(x.a.word))
  .sort((x, y) => y.s - x.s);
const suspicious = scored.slice(0, PER_GROUP * 4);
const suspiciousItems = pick(
  suspicious.map((x) => x.a.word),
  PER_GROUP,
  used,
)
  .map((w) => suspicious.find((x) => x.a.word === w).a)
  .filter(Boolean);
for (const it of suspiciousItems) used.add(it.word);
if (!DISAGREEMENTS)
  groups.push({
    key: 'X',
    title: 'Suspicious',
    blurb:
      'Where the converter is least confident: the stem was invented rather than looked up, the top two readings were close, or our answer disagrees with the silver. Highest chance of a real bug per word you read.',
    items: suspiciousItems,
  });

const randomItems = DISAGREEMENTS
  ? []
  : pick(vocabulary, PER_GROUP, used).map(assess).filter(Boolean);
if (!DISAGREEMENTS)
  groups.push({
    key: 'R',
    title: 'Random',
    blurb:
      'An unbiased draw from real running text — no heuristic, no cherry-picking. This is the group that catches what the suspicion score is blind to.',
    items: randomItems,
  });

// ------------------------------------------------------------------- render

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const scriptBox = (label, script, caption) =>
  script === undefined || script === ''
    ? ''
    : `<figure class="sbox"><div class="mn">${esc(script)}</div>
       <figcaption><strong>${esc(label)}</strong>${caption ? `<br>${esc(caption)}` : ''}
       <code>${esc(cps(script))}</code></figcaption></figure>`;

function itemBlock(item, id) {
  // Only offer a choice where there genuinely is one. When our output and
  // The silver's are the same code points there is nothing to choose between, and
  // asking "ours or the silver?" wastes a reviewer's answer on identical options —
  // which is exactly what happened on 2026-07-26 with цахиур and зохиомж.
  const contested = item.theirs !== undefined && item.agree === false;
  const options =
    item.before !== undefined
      ? ['New is right', 'Old was right', 'Both wrong', 'Not a real word']
      : contested
        ? ['Ours is right', 'The silver is right', 'Both wrong', 'Not a real word']
        : ['Correct', 'Wrong', 'Not a real word'];

  let oldScript;
  if (item.before !== undefined) {
    try {
      oldScript = toScript(item.before);
    } catch {
      oldScript = undefined;
    }
  }

  // The third branch says nothing about the silver. `silverAnswers` is a
  // local cache of the word harvest, which is a LEMMA list — so every inflected
  // form is absent from it by construction, and an absence there is not
  // evidence that any converter lacks an answer. The page claimed otherwise
  // until 2026-07-29, on 23 of 42 sampled words, and a reader reasonably read
  // that as fact. Say only what the cache actually knows.
  const agreeLine =
    item.agree === true
      ? '<p class="agree ok">identical to our cached silver answer — only asking whether both are right</p>'
      : item.agree === false
        ? '<p class="agree bad">disagrees with our cached silver answer</p>'
        : '<p class="agree dim">not in our harvest cache — no comparison available (the cache holds lemmas, so inflected forms are missing by construction, not because a converter lacks one)</p>';

  return `<div class="card">
  <p><span class="qid">${id}</span> <span class="cy">${esc(item.word)}</span>
     <code>${esc(item.classical)}</code></p>
  <p class="probe">stem <code>${esc(item.stem)}</code> · ${esc(item.chain)} ·
     stem from <strong>${esc(item.provenance)}</strong> ·
     confidence ${(item.confidence * 100).toFixed(0)}%</p>
  ${agreeLine}
  <div class="scripts">
    ${scriptBox(item.before !== undefined ? 'new' : item.agree === true ? 'ours & the silver' : 'ours', item.script, item.classical)}
    ${scriptBox('was', oldScript, item.before)}
    ${item.before === undefined && contested ? scriptBox('harvested', item.theirs, 'their converter') : ''}
  </div>
  <div class="opts">
    ${options
      .map(
        (o) =>
          `<label><input type="radio" name="${id}" value="${esc(o)}"> <span>${esc(o)}</span></label>`,
      )
      .join('\n    ')}
  </div>
  <div class="note-l"><input class="note" data-for="${id}" placeholder="note (optional) — what should it be?"></div>
</div>`;
}

const allIds = [];
const labels = {};
/**
 * Our own Classical form for each item, carried into the answer block.
 *
 * A verdict of "New is right" / "Correct" makes OUR output the ground truth,
 * and the reader has no reason to retype a romanization to say so. Without
 * this, whoever transcribes the answers into a fixture has to reconstruct that
 * form — and on 2026-07-29 that step produced three invented romanizations
 * (уйлаад, тоглоод, зууралдаад) that were about to be committed as ground
 * truth, in a project whose central rule is not to write forms from memory.
 * The page already knows the answer; it should say it.
 */
const ours = {};
const sections = groups
  .filter((g) => g.items.length > 0)
  .map((g) => {
    const blocks = g.items.map((item, i) => {
      const id = `${g.key}${i + 1}`;
      allIds.push(id);
      labels[id] = item.word;
      ours[id] = item.classical;
      return itemBlock(item, id);
    });
    return `<h2>${esc(g.title)}</h2><p class="sub">${esc(g.blurb)}</p>${blocks.join('')}`;
  })
  .join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>gege-converter spot check</title>
<style>
${baseCss()}
 :root{--ok:#1a7f4b;--bad:#b3261e}
 body{max-width:none}
 h2{font-size:1.15rem;margin:2.2em 0 .3em;border-bottom:1px solid var(--rule);padding-bottom:.3em;
   font-family:var(--font-mark);letter-spacing:-.01em}
 .sub{color:var(--dim);margin:0 0 1.6em;font-size:.94rem;line-height:1.6}
 .qid{background:color-mix(in srgb,var(--acc) 12%,transparent);color:var(--acc);border-radius:6px;
   padding:2px 9px;font-size:.75rem;font-weight:700;letter-spacing:.05em;font-family:var(--font-mark)}
 .cy{color:var(--ink);font-weight:700;font-size:1.12rem}
 .probe{color:var(--dim);font-size:.9rem;margin:.4em 0 .6em}
 .agree{font-size:.85rem;font-weight:600;margin:.2em 0 1em}
 .agree.ok{color:var(--ok)} .agree.bad{color:var(--bad)} .agree.dim{color:var(--dim)}
 .scripts{display:flex;flex-wrap:wrap;gap:16px;margin:1.1em 0 1.3em}
 .sbox{margin:0;background:var(--paper);border:1px solid var(--rule);border-radius:9px;
   padding:16px 14px;display:flex;flex-direction:column;align-items:center;gap:12px;min-width:150px}
 .mn{writing-mode:vertical-lr;text-orientation:sideways;
   font-family:var(--font-mongol);
   font-size:2.1rem;line-height:1.5;min-height:150px;color:var(--ink)}
 .sbox figcaption{font-size:.76rem;color:var(--dim);text-align:center;max-width:180px;line-height:1.45}
 .sbox figcaption code{font-size:.66rem;display:inline-block;margin-top:5px;word-break:break-all}
 .opts{display:flex;flex-direction:column;gap:7px;margin-top:.5em}
 .opts label{display:flex;align-items:center;gap:9px;cursor:pointer;padding:7px 11px;
   border-radius:7px;border:1px solid transparent;font-size:.93rem}
 .opts label:hover{background:color-mix(in srgb,var(--acc) 7%,transparent);border-color:var(--rule)}
 .opts input[type=radio]{accent-color:var(--acc);width:16px;height:16px;flex:none}
 .note-l{margin-top:4px}
 .note{width:100%;background:var(--paper);border:1px solid var(--rule);border-radius:6px;
   color:var(--ink);padding:7px 10px;font-size:.88rem;font-family:inherit}
 .note:focus{outline:none;border-color:var(--acc)}
 #out{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:2px solid var(--acc);
   padding:12px 20px;box-shadow:0 -8px 28px rgba(20,17,13,.14)}
 #out .row{display:flex;gap:12px;align-items:center;max-width:1040px;margin:0 auto}
 #answers{flex:1;background:var(--paper);border:1px solid var(--rule);border-radius:7px;color:var(--ink);
   font-family:var(--font-mono);font-size:.8rem;padding:9px 11px;
   height:74px;resize:vertical;white-space:pre;overflow:auto}
 button{background:var(--acc);color:#fff;border:0;border-radius:7px;padding:11px 18px;
   font-weight:700;cursor:pointer;font-size:.9rem;white-space:nowrap;font-family:var(--font-mark)}
 button:hover{filter:brightness(1.1)}
 .count{color:var(--dim);font-size:.8rem;white-space:nowrap}
</style></head><body><div class="wrap">
${header('spot check')}
${fontWarning()}
<h1>Spot check</h1>
<p class="sub">Pick an option on each, add a note where it helps, then hit <strong>Copy</strong> and
paste the block back to me. Script is vertical in the same font gege.mn uses — judge the shapes; code
points are under each rendering if you want to check the bytes.</p>

${sections}

<div id="out"><div class="row">
  <textarea id="answers" readonly placeholder="Make a selection above…"></textarea>
  <div style="display:flex;flex-direction:column;gap:6px;align-items:center">
    <button id="copy">Copy</button>
    <span class="count" id="count">0 answered</span>
  </div>
</div></div>

<script>
const IDS = ${JSON.stringify(allIds)};
const LABEL = ${JSON.stringify(labels)};
const OURS = ${JSON.stringify(ours)};
function build() {
  const lines = [];
  let n = 0;
  for (const id of IDS) {
    const sel = document.querySelector('input[name="' + id + '"]:checked');
    const note = document.querySelector('.note[data-for="' + id + '"]');
    const noteVal = note && note.value.trim();
    if (!sel && !noteVal) continue;
    n++;
    // The Classical form rides along so an approving verdict is directly
    // usable as a fixture row — nobody has to reconstruct what we emitted.
    const mine = OURS[id] ? ' = ' + OURS[id] : '';
    let line = id + ' (' + LABEL[id] + mine + '): ' + (sel ? sel.value : '(no option picked)');
    if (noteVal) line += ' — NOTE: ' + noteVal;
    lines.push(line);
  }
  const ta = document.getElementById('answers');
  ta.value = lines.length
    ? 'SPOT CHECK ANSWERS\\n# "= form" is OUR romanization, so an approving verdict needs no retyping.\\n'
      + lines.join('\\n')
    : '';
  document.getElementById('count').textContent = n + ' of ' + IDS.length + ' answered';
}
document.addEventListener('change', build);
document.addEventListener('input', build);
document.getElementById('copy').addEventListener('click', async () => {
  const ta = document.getElementById('answers');
  if (!ta.value) return;
  try { await navigator.clipboard.writeText(ta.value); }
  catch {
    ta.removeAttribute('readonly'); ta.select(); document.execCommand('copy');
    ta.setAttribute('readonly', '');
  }
  const b = document.getElementById('copy');
  b.textContent = 'Copied';
  setTimeout(() => { b.textContent = 'Copy'; }, 1400);
});
build();
</script>
${footer()}
</div></body></html>
`;

writeFileSync(resolve(ROOT, OUT), html);
console.log(`wrote ${OUT}`);
for (const g of groups) console.log(`  ${g.title.padEnd(22)} ${g.items.length}`);
console.log(`  vocabulary sampled from: ${vocabulary.length} distinct words`);
console.log(`  the silver answers available : ${silverAnswers.size}`);
