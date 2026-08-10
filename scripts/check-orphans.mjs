#!/usr/bin/env node
/**
 * Words whose stem AND suffix we already hold, that the pipeline still guesses.
 *
 *   pnpm build && node scripts/check-orphans.mjs [--top N] [--max-tokens PCT]
 *
 * ## Why this exists: a defect class that never needs a bichig reader
 *
 * Terminal output cannot be used to judge bichig, so every question of the form
 * "is this output correct?" has to reach a human, and the review loop is the
 * bottleneck on everything. This check exists because one large class of defect
 * is not that question at all.
 *
 * If Cyrillic word W is an attested row, and W' is W plus a suffix surface form
 * from our own tables, then W' resolving to `guess` means the segmenter had
 * every piece it needed and failed to assemble them. The known-correct stem is
 * discarded and the word is rebuilt letter by letter instead. **Whether the
 * output is right is a question for a reader; whether we ignored our own
 * dictionary is a structural property, and a script can rule on it.**
 *
 * ## It found the 2026-08-06 reader batch on its own
 *
 * That review returned eleven defects sharing one cause — the bare stem was
 * already correct and inflecting it threw the stem away:
 *
 *     хэмжээ  qemǰiy-e ✓   →  хэмжээнд  qemǰen-dü  ✗  (qemǰiyen-dü)
 *     үнэ     ün-e     ✓   →  үнийг     ün-i       ✗  (ün-e-yi)
 *     байшин  baising  ✓   →  байшингийн baišingγ-un ✗ (baising-un)
 *
 * Run against the corpus, this check ranks -ны/-ний genitives at the top of its
 * output — зүрхний, анхны, насны, нарны, дууны — which is the same defect,
 * found from structure alone. Had it existed a week earlier the reader would
 * have been asked a better question, or not asked at all.
 *
 * ## The tightening that makes it a gate and not a hint
 *
 * The obvious version — "longest attested prefix" — reports 12.1% of running
 * text and is mostly noise: жаргал is not жар + a suffix, хэрвээ is not хэр +
 * one, and a prefix that happens to be a word proves nothing. Requiring the
 * REMAINDER to be a known suffix surface as well cuts it to 2.05% and every
 * entry at the top of the list is real. A check nobody trusts gets ignored, so
 * the precision matters more than the recall here.
 *
 * Exits non-zero when the orphaned share exceeds `--max-tokens`, so it can sit
 * in the release gate next to `lint:output`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);

if (!existsSync(resolve(ROOT, 'dist/index.js'))) {
  console.error('needs a build first: pnpm build');
  process.exit(1);
}

const { analyze } = await load('dist/index.js');
const { harvestedIndex, lexiconIndex } = await load('dist/data/lexicon.js');
const { suffixes } = await load('dist/data/suffixes.js');
const { verbSuffixes } = await load('dist/data/verb-suffixes.js');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const TOP = Number(flag('--top', 20));
const MAX_TOKENS = Number(flag('--max-tokens', 2.5));

const CORPUS = '.tmp/parallel-lyrics.txt.gz';
const corpusPath = resolve(ROOT, CORPUS);
if (!existsSync(corpusPath)) {
  console.log(`needs ${CORPUS} — see the header of scripts/eval-corpus.mjs. Skipping.`);
  process.exit(0);
}

const attested = new Set([...lexiconIndex.keys(), ...harvestedIndex.keys()]);
const suffixForms = new Set([...suffixes, ...verbSuffixes].map((s) => s.cyrillic).filter(Boolean));

const freq = new Map();
for (const line of gunzipSync(readFileSync(corpusPath)).toString('utf8').split('\n')) {
  const cyrillic = line.split('|')[0];
  if (!cyrillic) continue;
  for (const raw of cyrillic.split(/\s+/)) {
    const w = raw.replace(/[^а-яёөүА-ЯЁӨҮ]/g, '').toLowerCase();
    if (w) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
}

/** Shortest stem worth trusting — below this, a "match" is a coincidence. */
const MIN_STEM = 3;

/** The first split of `w` into an attested stem plus a known suffix surface. */
const splitOf = (w) => {
  for (let n = w.length - 1; n >= MIN_STEM; n--) {
    const stem = w.slice(0, n);
    const rest = w.slice(n);
    if (attested.has(stem) && suffixForms.has(rest)) return [stem, rest];
  }
  return undefined;
};

let candidates = 0;
let totalTokens = 0;
let orphanTokens = 0;
const orphans = [];

for (const [w, n] of freq) {
  totalTokens += n;
  if (attested.has(w)) continue;
  const split = splitOf(w);
  if (split === undefined) continue;
  candidates++;
  const tokens = analyze(w);
  // A clitic split is a different question and is handled by its own stage.
  if (tokens.length !== 1) continue;
  if (tokens[0].candidates[0]?.provenance !== 'guess') continue;
  orphanTokens += n;
  orphans.push({ w, split, n });
}

orphans.sort((a, b) => b.n - a.n);
const share = (100 * orphanTokens) / totalTokens;

console.log(`corpus: ${freq.size.toLocaleString()} types, ${totalTokens.toLocaleString()} tokens`);
console.log(`attested stem + known suffix: ${candidates.toLocaleString()} types`);
console.log();
console.log('ORPHANED — both halves are in our data and the word still guesses');
console.log(
  `  ${orphans.length.toLocaleString()} types (${((100 * orphans.length) / candidates).toFixed(1)}% of candidates)`,
);
console.log(`  ${orphanTokens.toLocaleString()} tokens = ${share.toFixed(2)}% of running text`);
console.log();
console.log(`the ${TOP} heaviest:`);
for (const { w, split, n } of orphans.slice(0, TOP)) {
  console.log(`  ${String(n).padStart(5)}  ${w.padEnd(16)} = ${split[0]} + ${split[1]}`);
}

if (share > MAX_TOKENS) {
  console.error(`\nFAIL: ${share.toFixed(2)}% orphaned exceeds --max-tokens ${MAX_TOKENS}%`);
  process.exit(1);
}
console.log(`\nOK: ${share.toFixed(2)}% orphaned, at or under the ${MAX_TOKENS}% ceiling`);
