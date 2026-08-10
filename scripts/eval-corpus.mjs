#!/usr/bin/env node
/**
 * Token-weighted accuracy against a parallel corpus of running text.
 *
 *   curl -o .tmp/parallel-lyrics.txt.gz -L \
 *     https://raw.githubusercontent.com/tugstugi/mongolian-nlp/master/bichig2cyrillic/lyrics.txt.gz
 *   node scripts/eval-corpus.mjs [--misses N] [--tier TIER]
 *
 * Why this exists, when `eval.mjs` already scores gold: every fixture in this
 * repo is a TYPE list, and a type list cannot see a fix land. Both gold sets are
 * harvest-derived, so a word the dictionary already carries never reaches the
 * guesser and a guesser fix is invisible in the score — measured 2026-07-31, a
 * change that fixed 743 corpus words moved gold by +3. Weighting by how often a
 * word actually occurs is the missing measurement, and the two numbers diverge
 * hard: 32.6% of types are right against 62.3% of tokens.
 *
 * Read the per-tier slice, not the total. `lexicon` scores 80.5% of tokens and
 * `harvested` 76.7%, but `guess` scores 17.3% while carrying 25.8% of all
 * running text. That is where the loss is, and no type-list fixture shows it.
 *
 * ⚠ THE REFERENCE IS SILVER, NOT GOLD. The bichig side is one converter's bulk
 * output (Inner Mongolia University's online tool), following Inner Mongolian
 * convention and predating the 2026 rulebook. It is the same trust tier as
 * `harvested`. Do not read a disagreement as an error — read it as a question,
 * ranked by how much running text it is worth. The corpus is also song lyrics,
 * so the genre skew is severe (минь occurs 10,437 times).
 *
 * Two differences are DELIBERATE and are folded away before scoring, or they
 * would drown everything else:
 *
 *   1. the suffix connector — the reference writes legacy NNBSP, we write MVS;
 *   2. the medial i-diphthong — the reference writes Classical V+y+i (sayin),
 *      we write V+i per UTN #57, ruled 2026-07-26. That difference alone is
 *      808 word types and 6.26% of all running text.
 *
 * FVS is folded too. At this scale we cannot judge a selector disagreement, and
 * leaving it in would report convention noise as error.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { analyze } = await load('dist/index.js');

const CORPUS = '.tmp/parallel-lyrics.txt.gz';
const args = process.argv.slice(2);
const missesAt = args.indexOf('--misses');
const showMisses = missesAt >= 0 ? Number(args[missesAt + 1] ?? 30) : 0;
const tierAt = args.indexOf('--tier');
const onlyTier = tierAt >= 0 ? args[tierAt + 1] : null;

if (!existsSync(CORPUS)) {
  console.error(`missing ${CORPUS} — see the header for the curl command`);
  process.exit(1);
}

// The connector characters are space-like to String.split, so a detached suffix
// would become its own token and every line would misalign. Split on U+0020 only.
const FOLD = /[\u180B-\u180F\u202F\u0020]/g;
const fold = (s) => s.replace(FOLD, '').replaceAll('ᠶᠢ', 'ᠢ');

const counts = new Map(); // cyrillic -> {n, forms: Map<ref, count>}
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
    let rec = counts.get(w);
    if (!rec) {
      rec = { n: 0, forms: new Map() };
      counts.set(w, rec);
    }
    rec.n += 1;
    rec.forms.set(bi[i], (rec.forms.get(bi[i]) ?? 0) + 1);
  }
}

const rows = [...counts.entries()]
  .map(([cy, r]) => ({
    cy,
    n: r.n,
    // The reference's own majority reading. Where it is not unanimous the
    // minority is usually its own inconsistency, not real ambiguity.
    ref: [...r.forms.entries()].sort((a, b) => b[1] - a[1])[0][0],
    unanimous: r.forms.size === 1,
  }))
  .sort((a, b) => b.n - a.n);

const tally = { type: 0, token: 0, typeN: 0, tokenN: 0 };
const byTier = new Map();
const misses = [];

for (const r of rows) {
  const [a] = analyze(r.cy);
  const winner = a?.candidates[0];
  const tier = winner?.provenance ?? 'none';
  if (onlyTier && tier !== onlyTier) continue;

  const hit = winner !== undefined && fold(winner.script) === fold(r.ref);
  tally.typeN += 1;
  tally.tokenN += r.n;
  if (hit) {
    tally.type += 1;
    tally.token += r.n;
  } else if (showMisses) {
    misses.push({ ...r, ours: winner?.script ?? '(none)', tier });
  }

  let t = byTier.get(tier);
  if (!t) {
    t = { type: 0, typeN: 0, token: 0, tokenN: 0 };
    byTier.set(tier, t);
  }
  t.typeN += 1;
  t.tokenN += r.n;
  if (hit) {
    t.type += 1;
    t.token += r.n;
  }
}

const pct = (a, b) => (b === 0 ? '   n/a' : `${((100 * a) / b).toFixed(1)}%`.padStart(6));

console.log(`corpus: ${rows.length} types, ${rows.reduce((s, r) => s + r.n, 0)} tokens`);
console.log(`reference is unanimous on ${rows.filter((r) => r.unanimous).length} types\n`);
console.log(`                    type          token`);
console.log(
  `  OVERALL       ${pct(tally.type, tally.typeN)} ${pct(tally.token, tally.tokenN)}   ${tally.typeN} types / ${tally.tokenN} tokens`,
);
console.log('');
for (const [tier, t] of [...byTier.entries()].sort((a, b) => b[1].tokenN - a[1].tokenN)) {
  console.log(
    `  ${tier.padEnd(12)}  ${pct(t.type, t.typeN)} ${pct(t.token, t.tokenN)}   ${String(t.typeN).padStart(5)} types / ${String(t.tokenN).padStart(6)} tokens`,
  );
}

if (showMisses) {
  console.log(`\ntop ${showMisses} disagreements by token frequency — a QUEUE, not an error list:`);
  for (const m of misses.sort((a, b) => b.n - a.n).slice(0, showMisses)) {
    console.log(
      `  ${m.cy.padEnd(14)} ${String(m.n).padStart(5)} [${m.tier.padEnd(10)}] ours=${m.ours}  ref=${m.ref}`,
    );
  }
}
