#!/usr/bin/env node
/**
 * Score the converter against **reader-written parallel sentences**.
 *
 *   pnpm build && pnpm eval:parallel [--corpus PATH] [--top N] [--sentences]
 *
 * ## What this measures that nothing else does
 *
 * `scripts/eval.mjs` scores 1,884 inflected forms from a lemma dictionary and
 * `.tmp/verb-gold.jsonl` scores 197 verb forms; both are word lists, and the
 * first has a measured selection bias — its 273 attached -тай³ rows score 0.0%
 * because a lemma list only ever carries the adjectival ones as headwords.
 * `check:orphans` finds a defect class structurally but cannot say whether any
 * output is *right*. The gap between them is running prose, judged by a human,
 * and that is exactly what this reads.
 *
 * It also changes what the review loop costs. Asking a reader to rule on a page
 * of words costs their attention every round and is the standing bottleneck on
 * everything here. A corpus is paid for once and then re-scored on every commit.
 *
 * ## Privacy: the default output is shareable, the corpus is not
 *
 * The sentences are somebody's writing and stay private (`docs/parallel-corpus.md`).
 * So by default this prints **word-level** diagnostics only — individual word
 * pairs, which are facts about Mongolian rather than about anyone's article, and
 * are the same thing a lexicon row is. Whole sentences are printed only under
 * `--sentences`, which is for reading on your own machine.
 *
 * Comparison is in SCRIPT, since both sides already are; the romanization
 * beside each is there because it is what this project can actually audit by
 * eye, per CLAUDE.md.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodingProblems, loadCorpus } from './lib/corpus.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (rel) => import(pathToFileURL(resolve(ROOT, rel)).href);

if (!existsSync(resolve(ROOT, 'dist/index.js'))) {
  console.error('needs a build first: pnpm build');
  process.exit(1);
}
const { convert } = await load('dist/index.js');
const { fromScript } = await load('dist/romanize.js');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const TOP = Number(flag('--top', 25));
const SHOW_SENTENCES = args.includes('--sentences');

const { root, pairs: allPairs, problems } = loadCorpus(flag('--corpus', undefined));

// A pair whose bichig carries PUA or NNBSP did not come out of the editor it
// was supposed to, so it is not evidence about anything — scoring the converter
// against it would report our correct output as wrong. Excluded and counted,
// never silently dropped.
const pairs = allPairs.filter((p) => encodingProblems(p).length === 0);
const excluded = allPairs.length - pairs.length;

if (root === undefined) {
  console.log('no parallel corpus found.');
  console.log('  expected ../gege-corpus, or $GEGE_CORPUS, or --corpus PATH');
  console.log('  format and rationale: docs/parallel-corpus.md');
  process.exit(0);
}
console.log(`corpus: ${root}`);

if (problems.length > 0) {
  console.log(`\n⚠ ${problems.length} problem(s) in the corpus itself:`);
  for (const p of problems.slice(0, 20)) console.log(`   ${p}`);
  if (problems.length > 20) console.log(`   … and ${problems.length - 20} more`);
}

if (pairs.length === 0) {
  console.log('\nno sentence pairs. Nothing to score.');
  process.exit(0);
}

const rom = (s) => {
  try {
    return fromScript(s);
  } catch {
    return s;
  }
};

let exact = 0;
let aligned = 0;
let wordsTotal = 0;
let wordsRight = 0;
const misses = new Map();
const ragged = [];

for (const pair of pairs) {
  const got = convert(pair.cyrillic);
  if (got === pair.script) exact += 1;

  const cyrWords = pair.cyrillic.split(/\s+/).filter(Boolean);
  const wantWords = pair.script.split(/\s+/).filter(Boolean);
  const gotWords = got.split(/\s+/).filter(Boolean);

  // Token counts diverge legitimately — мэдэхгүй is one Cyrillic word and two
  // bichig ones (`medeqü üγei`), which `splitClitics` is *supposed* to do. So a
  // ragged sentence is reported, never force-aligned: positional alignment over
  // count-mismatched pairs was measured at 83.4% in `align-sentences.mjs`, and
  // its errors arrive in runs, which is the signature of a silent offset.
  if (wantWords.length !== gotWords.length) {
    ragged.push({ ...pair, got });
    continue;
  }
  aligned += 1;
  for (let i = 0; i < wantWords.length; i += 1) {
    wordsTotal += 1;
    if (wantWords[i] === gotWords[i]) {
      wordsRight += 1;
      continue;
    }
    // Key by the Cyrillic when the token counts let us name it, so the report
    // is a list of words to fix rather than a list of glyph differences.
    const key = cyrWords.length === wantWords.length ? cyrWords[i] : `?${i}`;
    const entry = misses.get(key) ?? { n: 0, want: wantWords[i], got: gotWords[i] };
    entry.n += 1;
    misses.set(key, entry);
  }
}

const pct = (a, b) => (b === 0 ? '—' : `${((100 * a) / b).toFixed(1)}%`);

console.log(`\nsentences            ${pairs.length}`);
if (excluded > 0)
  console.log(`  excluded (encoding)${String(excluded).padStart(4)}  — see problems above`);
console.log(`  exact match        ${exact}  ${pct(exact, pairs.length)}`);
console.log(`  token-aligned      ${aligned}  ${pct(aligned, pairs.length)}`);
console.log(`  ragged (see below) ${ragged.length}`);
console.log(`\nwords (aligned sentences only)`);
console.log(`  correct            ${wordsRight} / ${wordsTotal}  ${pct(wordsRight, wordsTotal)}`);

const ranked = [...misses.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`\nthe ${Math.min(TOP, ranked.length)} heaviest wrong words (ours → theirs):`);
for (const [cyrillic, m] of ranked.slice(0, TOP)) {
  console.log(
    `  ${String(m.n).padStart(3)}  ${cyrillic.padEnd(18)} ${rom(m.got).padEnd(22)} → ${rom(m.want)}`,
  );
}

if (ragged.length > 0) {
  console.log(`\nragged sentences — our token count differs, so no word score:`);
  for (const r of ragged.slice(0, 10)) {
    console.log(
      `  ${r.where}: ours ${r.got.split(/\s+/).length} tokens, theirs ${r.script.split(/\s+/).length}`,
    );
    if (SHOW_SENTENCES) {
      console.log(`      cyrillic: ${r.cyrillic}`);
      console.log(`      ours    : ${rom(r.got)}`);
      console.log(`      theirs  : ${rom(r.script)}`);
    }
  }
  if (!SHOW_SENTENCES) console.log('  (--sentences to print them; that output is NOT shareable)');
}
