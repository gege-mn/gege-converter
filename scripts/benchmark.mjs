#!/usr/bin/env node
/**
 * Benchmark against a two-silver consensus set, with WER and CER.
 *
 *   node scripts/benchmark.mjs [--html out.html] [--misses N]
 *                             [--dump-words f.txt] [--model preds.tsv]
 *
 * ## The problem this solves
 *
 * There is no large true-gold set for this task and there never has been. Every
 * sizeable fixture in this repo is *silver* — one converter's bulk output — and
 * scoring against silver measures divergence from that system, not correctness.
 * Worse, `harvested-lexicon.ts` **is** the silver's answers, so scoring the
 * pipeline against the silver is circular wherever the harvested tier fires.
 *
 * ## The construction
 *
 * Two independent converters are now available:
 *
 *   A. The silver, via `test/fixtures/harvested-inflected.json` — 1,884 inflected
 *      forms **deliberately held out** of the lexicon, so they are not circular;
 *   B. Inner Mongolia University's online tool, via the parallel corpus.
 *
 * Their intersection is 684 word types that both systems answer and that our
 * lexicon does not contain. Where the two **agree with each other**, that
 * consensus is the best available proxy for gold: two systems built by
 * different people from different sources landing on the same string is real
 * evidence. Where they disagree, neither is trustworthy and the item is
 * excluded rather than guessed at.
 *
 * This is the k=1→k=2 agreement effect the review found: the single largest
 * precision gain comes from having a second independent opinion at all.
 *
 * ## What it still is not
 *
 * ⚠ Consensus is not truth. Both silver sets follow Inner Mongolian convention
 * and predate the 2026 rulebook, so they can agree and both be wrong — and they
 * will agree *most* confidently exactly where a shared convention differs from
 * ours. The published literature warns about this directly: agreement signals
 * salience, not correctness. Treat the number as an upper bound on divergence,
 * not a certificate. Only a reader settles a disputed item.
 *
 * Two of our differences are deliberate and are folded away before scoring or
 * they dominate everything: the NNBSP/MVS connector, and the V+y+i diphthong
 * rejected per UTN #57. FVS is folded too.
 *
 * ## Scoring the neural model on this same set
 *
 * `--dump-words` writes the consensus types for `training/convert.py`, and
 * `--model` reads the resulting TSV back and adds model and hybrid rows.
 *
 * This is a fair test **and the reason is worth stating**: the benchmark set is
 * drawn from `harvested-inflected.json`, and `export-training-data.mjs` removes
 * every one of those 1,768 keys from train and val *by Cyrillic surface form*,
 * asserting no leak before it writes. So the model has never seen these words.
 * Their stems it has seen, in other inflected forms — which is exactly the
 * pipeline's position too, so the comparison is like for like.
 *
 * ⚠ What it does **not** control for: the model's training targets are the
 * harvest, and half of this consensus set is that same silver.
 * The model is being scored against a convention it was trained to imitate. The
 * pipeline's harvested tier has the identical advantage, so the two are
 * comparable to each other — but neither number transfers to a reader-gold set.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { emptyAttested } from './lib/derivation.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { analyze } = await load('dist/index.js');
// The consensus set is drawn from a gold fixture, and the `attested` tier holds
// whole words from the same source as half of this silver set. Left live it
// answers the test from memory — see scripts/lib/derivation.mjs.
await emptyAttested(ROOT);
const { toScript } = await load('dist/romanize.js');
const { normalizeOrthography } = await load('dist/orthography.js');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const HTML = flag('--html', null);
const SHOW = Number(flag('--misses', 0));
const DUMP = flag('--dump-words', null);
const MODEL = flag('--model', null);

const CORPUS = '.tmp/parallel-lyrics.txt.gz';
const GOLD = 'test/fixtures/harvested-inflected.json';
if (!existsSync(CORPUS)) {
  console.error(`missing ${CORPUS} — see scripts/eval-corpus.mjs for the curl command`);
  process.exit(1);
}

// FVS1-4 + MVS (U+180B–180F), NNBSP (U+202F) and plain space, as escapes — never
// as literals. Writing this class with the invisible characters typed directly
// silently dropped U+202F on 2026-07-31 and inverted the headline result: the
// two silver sets appeared to agree 10% of the time when the real figure is 88%.
// That is exactly the failure CLAUDE.md's escape rule exists to prevent.
const FOLD = /[\u180B-\u180F\u202F\u0020]/g;
const fold = (s) => s.replace(FOLD, '').replaceAll('ᠶᠢ', 'ᠢ');

/** Levenshtein over code points, for CER. */
const editDistance = (a, b) => {
  const s = [...a];
  const t = [...b];
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const cur = [i];
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[t.length];
};

// ------------------------------------------------------ silver A: the silver
const silverA = new Map();
for (const r of JSON.parse(readFileSync(resolve(ROOT, GOLD), 'utf8')).entries) {
  try {
    silverA.set(r.cyrillic, toScript(r.classical));
  } catch {
    // a fixture row we cannot render is not a silver
  }
}

// ------------------------------------------------------------- silver B: IMU
const imuForms = new Map();
const freq = new Map();
for (const line of gunzipSync(readFileSync(CORPUS)).toString('utf8').split('\n')) {
  const bar = line.indexOf('|');
  if (bar < 0) continue;
  const cy = line.slice(0, bar).split(' ').filter(Boolean);
  const bi = line
    .slice(bar + 1)
    .split(' ')
    .filter(Boolean);
  if (cy.length !== bi.length) continue;
  for (const [i, w] of cy.entries()) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
    let m = imuForms.get(w);
    if (!m) {
      m = new Map();
      imuForms.set(w, m);
    }
    m.set(bi[i], (m.get(bi[i]) ?? 0) + 1);
  }
}
// ⚠ Both silver sets must be normalised the SAME way or the comparison is a lie.
// `harvested-inflected.json` stores forms that already went through
// `normalizeOrthography` at import time, so the raw IMU text has to as well —
// otherwise the o/ö rule alone makes two systems that agree look like they
// disagree. This is CLAUDE.md's "encoding-repaired is not orthography-repaired"
// footgun, one level up: normalising one side only is worse than neither.
const imu = new Map(
  [...imuForms.entries()].map(([w, m]) => [
    w,
    normalizeOrthography([...m.entries()].sort((a, b) => b[1] - a[1])[0][0]),
  ]),
);

// ------------------------------------------------------------- the consensus set
const both = [...silverA.keys()].filter((w) => imu.has(w));
const consensus = [];
const contested = [];
for (const w of both) {
  const a = fold(silverA.get(w));
  const b = fold(imu.get(w));
  (a === b ? consensus : contested).push({
    w,
    n: freq.get(w) ?? 0,
    silverA: silverA.get(w),
    imu: imu.get(w),
  });
}

if (DUMP) {
  writeFileSync(DUMP, `${consensus.map((c) => c.w).join('\n')}\n`);
  console.log(`wrote ${consensus.length} consensus types to ${DUMP}\n`);
}

// ------------------------------------------------------------- the predictors
// `analyze` is called once per type and memoised: the tier slices below would
// otherwise re-run the whole pipeline three times over the same 604 words.
const pipelineCache = new Map();
const pipeline = (w) => {
  let p = pipelineCache.get(w);
  if (!p) {
    const [a] = analyze(w);
    p = { script: a?.candidates[0]?.script ?? '', tier: a?.candidates[0]?.provenance ?? 'none' };
    pipelineCache.set(w, p);
  }
  return p;
};

const modelPreds = new Map();
if (MODEL) {
  for (const line of readFileSync(resolve(ROOT, MODEL), 'utf8').split('\n')) {
    const tab = line.indexOf('\t');
    if (tab > 0) modelPreds.set(line.slice(0, tab).trim(), line.slice(tab + 1).trim());
  }
  const missing = consensus.filter((c) => !modelPreds.has(c.w));
  if (missing.length) {
    // A silently absent prediction scores as an empty string, which reads as a
    // model error rather than as a missing file. Fail instead of under-reporting.
    console.error(
      `${MODEL} is missing ${missing.length} of ${consensus.length} consensus types, e.g. ${missing[0].w}`,
    );
    process.exit(1);
  }
}

// The hybrid is the arrangement `neural-model.md` specifies: dictionaries keep
// every type they can answer from real data, and the model is only allowed the
// slice where the pipeline would otherwise fall back to `guessStem`.
const model = (w) => ({ script: modelPreds.get(w) ?? '', tier: 'model' });
const hybrid = (w) => {
  const p = pipeline(w);
  return p.tier === 'guess' ? model(w) : p;
};

// -------------------------------------------------------------------- scoring
const score = (items, predict = pipeline) => {
  let exact = 0;
  let chars = 0;
  let dist = 0;
  let tokens = 0;
  let tokenHit = 0;
  const misses = [];
  for (const it of items) {
    const ref = fold(it.silverA);
    const { script: ours, tier } = predict(it.w);
    const got = fold(ours);
    tokens += it.n;
    chars += [...ref].length;
    dist += editDistance(got, ref);
    if (got === ref) {
      exact += 1;
      tokenHit += it.n;
    } else {
      misses.push({ ...it, ours, tier });
    }
  }
  return {
    n: items.length,
    wer: 1 - exact / items.length,
    cer: dist / chars,
    tokenWer: tokens ? 1 - tokenHit / tokens : 0,
    tokens,
    misses,
  };
};

// Both slices are defined by which tier the *pipeline* reaches for, so that the
// model and hybrid rows are scored on exactly the same types as the rows they
// are meant to be read against.
const guessed = consensus.filter((it) => pipeline(it.w).tier === 'guess');
const backed = consensus.filter((it) => pipeline(it.w).tier !== 'guess');

const overall = score(consensus);
const guessOnly = score(guessed);
const dataBacked = score(backed);

const pc = (x) => `${(100 * x).toFixed(2)}%`;
const rows = [
  ['ours — consensus set, all', overall],
  ['ours — where a lexicon tier fired', dataBacked],
  ['ours — where the guesser fired', guessOnly],
];
if (MODEL) {
  rows.push(
    ['model alone — all', score(consensus, model)],
    // The data-backed row is here to answer a question the gold set answers the
    // other way round. On gold the model beats the pipeline on the `harvested`
    // tier, which reads as an argument for promoting it above the dictionaries.
    // On this set it does not. Print both so the disagreement is visible instead
    // of whichever one was looked at first.
    ['model alone — where a lexicon tier fired', score(backed, model)],
    ['model alone — where the guesser fired', score(guessed, model)],
    ['hybrid — model only on the guessed slice', score(consensus, hybrid)],
  );
}

console.log(`two-silver intersection: ${both.length} types`);
console.log(
  `  the two silver sets AGREE on   ${consensus.length}  (${pc(consensus.length / both.length)}) — the benchmark set, ${overall.tokens} corpus tokens`,
);
console.log(
  `  they CONTEST                  ${contested.length}  (${pc(contested.length / both.length)}) — excluded, neither is trustworthy\n`,
);
console.log(`  ${''.padEnd(42)} types      WER      CER   token-WER`);
for (const [label, s] of rows) {
  console.log(
    `  ${label.padEnd(42)} ${String(s.n).padStart(5)}  ${pc(s.wer).padStart(7)}  ${pc(s.cer).padStart(7)}  ${pc(s.tokenWer).padStart(8)}`,
  );
}
console.log('\n  published, DIFFERENT DATA (58k dictionary headwords, Na et al. 2022):');
console.log('    Transformer (6S 4H)                        16.92%    3.15%');
console.log('    joint-sequence n-gram (N=9)                22.63%    4.20%');

if (SHOW) {
  console.log(`\ntop ${SHOW} consensus misses by corpus frequency:`);
  for (const m of overall.misses.sort((a, b) => b.n - a.n).slice(0, SHOW)) {
    console.log(
      `  ${m.w.padEnd(14)} ${String(m.n).padStart(5)} [${m.tier.padEnd(9)}] ours=${m.ours}  both refs=${m.silverA}`,
    );
  }
}

if (HTML) {
  const { baseCss, footer, header } = await import(
    pathToFileURL(resolve(ROOT, 'scripts/lib/brand.mjs')).href
  );
  const tr = (label, s, note = '') =>
    `<tr><td>${label}${note ? `<span class="note">${note}</span>` : ''}</td><td class="num">${s.n}</td><td class="num">${pc(s.wer)}</td><td class="num">${pc(s.cer)}</td><td class="num">${pc(s.tokenWer)}</td></tr>`;
  const missRows = overall.misses
    .sort((a, b) => b.n - a.n)
    .slice(0, 40)
    .map(
      (m) =>
        `<tr><td class="cyr">${m.w}</td><td class="num">${m.n}</td><td class="tier">${m.tier}</td><td class="bi">${m.ours}</td>${
          MODEL ? `<td class="bi">${modelPreds.get(m.w) ?? ''}</td>` : ''
        }<td class="bi">${m.silverA}</td></tr>`,
    )
    .join('\n');
  const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Benchmark — two-silver consensus</title>
<style>${baseCss()}
table{border-collapse:collapse;width:100%;margin:1rem 0 2.5rem}
th{text-align:left;font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);
   border-bottom:1px solid var(--rule);padding:.5rem .6rem}
td{border-bottom:1px solid var(--rule);padding:.55rem .6rem;vertical-align:top}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td .note{display:block;font-size:.72rem;color:var(--dim)}
tr.ref td{color:var(--dim)}
td.bi{font-size:1.5rem;line-height:1.2}
td.cyr{white-space:nowrap}
td.tier{font-size:.75rem;color:var(--dim)}
.lede{max-width:44rem;line-height:1.55}
.warn{border-left:3px solid var(--acc);padding:.6rem 1rem;margin:1.5rem 0;background:color-mix(in srgb,var(--acc) 6%,transparent)}
</style>
${header('benchmark')}
<main>
<h1>Benchmark: a two-silver consensus set</h1>
<p class="lede">There is no large true-gold set for this task. Both big fixtures are one
converter's output, and <b>our harvested tier <i>is</i> one of them</b>, so scoring against it
is circular. This benchmark instead uses the ${both.length} word types that <b>two independent
converters</b> both answer and our lexicon does not contain, and keeps only the
${consensus.length} where the two <b>agree with each other</b>.</p>
<div class="warn"><b>Consensus is not truth.</b> Both silver sets follow Inner Mongolian
convention and predate the 2026 rulebook, so they can agree and both be wrong — and they will
agree most confidently exactly where a shared convention differs from ours. Read this as an
upper bound on divergence, not a certificate.</div>
<table>
<thead><tr><th>system</th><th>types</th><th>WER</th><th>CER</th><th>token-WER</th></tr></thead>
<tbody>
${tr('ours — consensus set, all', overall)}
${tr('ours — where a lexicon tier fired', dataBacked)}
${tr('ours — where the guesser fired', guessOnly)}
${
  MODEL
    ? `${tr('model alone — all', score(consensus, model), 'the 7.4M character transformer, never trained on these types')}
${tr('model alone — where the guesser fired', score(guessed, model), 'the same 68 types the guesser gets 88.24% wrong')}
${tr('hybrid — model only on the guessed slice', score(consensus, hybrid), 'dictionaries keep every type they can answer from real data')}`
    : ''
}
<tr class="ref"><td>Transformer, Na et al. 2022<span class="note">different data: 58k dictionary headwords, random split</span></td><td class="num">5232</td><td class="num">16.92%</td><td class="num">3.15%</td><td class="num">—</td></tr>
<tr class="ref"><td>joint-sequence n-gram, same paper<span class="note">the pre-neural baseline</span></td><td class="num">5232</td><td class="num">22.63%</td><td class="num">4.20%</td><td class="num">—</td></tr>
</tbody></table>
<h2>Where we differ from both silver sets at once</h2>
<p class="lede">Ranked by corpus frequency. These are the items where two independent systems
agree and we do not — the highest-value questions available without a reader ruling on
something contested.</p>
<table><thead><tr><th>Cyrillic</th><th>corpus</th><th>tier</th><th>ours</th>${
    MODEL ? '<th>model</th>' : ''
  }<th>both silver sets</th></tr></thead>
<tbody>${missRows}</tbody></table>
</main>
${footer()}`;
  writeFileSync(HTML, html);
  console.log(`\nwrote ${HTML}`);
}
