#!/usr/bin/env node
/**
 * Score the converter against the gold answers for inflected forms.
 *
 * Unlike the unit tests, nothing here is memorized: every gold row is held out
 * of the lexicon by `import-harvest.mjs`, so a hit means the pipeline actually
 * segmented the word, resolved the stem and regenerated the chain.
 *
 * Reports five numbers, which together say WHERE the loss is:
 *   EMITTED      what `convert()` actually returns -> the user-facing number
 *   best segmented  best candidate THAT HAS SUFFIXES -> did segmentation work
 *   chain-only   suffix chain right, stem wrong  -> stem guesser's fault
 *   oracle       accuracy given a perfect stem   -> the ceiling to aim at
 *   unreachable  gold the segmenter+table cannot produce at all -> real gaps
 *
 * ⚠ **The first two are different numbers and both used to be called "top-1".**
 * `best segmented` skips a whole-word memorised reading to ask whether the
 * segmenter and the suffix chain did their job; `EMITTED` is what a user gets.
 * They differ by 34 forms on the detached set (75.9% vs 73.7% on 2026-08-10),
 * and `eval-model.mjs` and `status.mjs` report the *emitted* one under the same
 * old name. Quote a number together with the script that produced it, or say
 * which of these two it is — on 2026-08-10 the two were briefly equal at 73.7%
 * for unrelated reasons and an hour went into attributing a regression to the
 * wrong change.
 *
 * `--coverage` additionally reports the share of word tokens in real running
 * text whose stem came from real data rather than the guesser. THAT is the
 * metric that tracks harvest progress: top-1 above cannot, because each harvest
 * grows the lexicon and the gold set together and the forms it adds are the
 * harder ones. On 2026-07-26 the lexicon nearly doubled, top-1 went 52.5% ->
 * 50.9%, and coverage went 63.8% -> 70.1%. Only the second number was real.
 *
 * `--sentences` reports the same corpus per SENTENCE instead of per word. Every
 * other number here is per word, which flatters the converter badly: accuracy
 * multiplies across a sentence, so 65.7% per word is ~2% per nine-word
 * sentence. This is the number to quote when anyone asks whether arbitrary text
 * can be converted unattended.
 *
 *   node scripts/eval.mjs [--misses N] [--coverage] [--sentences]
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { analyze } = await load('dist/index.js');
const { assemble } = await load('dist/generate.js');
const { segment } = await load('dist/segment.js');
const { toScript } = await load('dist/romanize.js');

/**
 * Compare in SCRIPT, never in romanization. γ/g and q/k are allographs of one
 * letter chosen by harmony, so `ger` and `γer` are the same word and the same
 * code points — string-comparing the romanizations invents disagreements that
 * do not exist. Only the emitted code points are authoritative.
 */
const asScript = (classical) => {
  try {
    return toScript(classical);
  } catch {
    return undefined;
  }
};
const sameWord = (a, b) => {
  if (a === undefined || b === undefined) return false;
  const x = asScript(a);
  return x !== undefined && x === asScript(b);
};
/** Allograph-insensitive romanization, for comparing suffix chains. */
const flatten = (s) => s.replaceAll('γ', 'g').replaceAll('q', 'k');

const showMisses = Number(
  process.argv.includes('--misses') ? process.argv[process.argv.indexOf('--misses') + 1] : 0,
);

const allGold = JSON.parse(
  readFileSync(resolve(ROOT, 'test/fixtures/harvested-inflected.json'), 'utf8'),
).entries;
const detachedGold = allGold.filter((g) => g.detached);
const attachedGold = allGold.filter((g) => !g.detached);

const goldStem = (classical) => {
  const parts = classical.split('-');
  return /^[ae]$/.test(parts[1] ?? '') ? `${parts[0]}-${parts[1]}` : parts[0];
};
const goldChain = (classical) => {
  const parts = flatten(classical).split('-');
  return (/^[ae]$/.test(parts[1] ?? '') ? parts.slice(2) : parts.slice(1)).join('+');
};

function evaluate(gold, { collectMisses = false } = {}) {
  const stats = { top1: 0, emitted: 0, chainOnly: 0, wrong: 0, none: 0, oracle: 0, unreachable: 0 };
  /** Same scoring, split by where the winning candidate's stem came from. */
  const byTier = { lexicon: [0, 0], harvested: [0, 0], toli: [0, 0], guess: [0, 0] };
  const misses = [];

  for (const g of gold) {
    const [token] = analyze(g.cyrillic);
    // ⚠ NOT `candidates[0]`. This is the best candidate **that has suffixes**,
    // which is the right denominator for "did the segmenter and the chain do
    // their job" — a whole-word memorised reading tells you nothing about
    // either. It is NOT what the converter emits, and the two differ by 34
    // forms on the detached set today (75.9% here against 73.7% emitted).
    //
    // Both numbers were called "top-1" until 2026-08-10, in this script and in
    // `eval-model.mjs`/`status.mjs` respectively, and on that day they were
    // briefly the *same* number (73.7%) for different reasons — which is how a
    // session spent an hour attributing a regression to the wrong change.
    // `emitted` below is now reported beside it so neither can be quoted alone.
    const winner = token.candidates.find((c) => c.segmentation.suffixes.length > 0);
    const best = winner?.classical;
    if (sameWord(token.candidates[0]?.classical, g.classical)) stats.emitted += 1;

    const hit = sameWord(best, g.classical);
    const tier = byTier[winner?.provenance ?? 'guess'];
    tier[1] += 1;
    if (hit) tier[0] += 1;

    if (hit) stats.top1 += 1;
    else if (best === undefined) stats.none += 1;
    else if (goldChain(best) === goldChain(g.classical)) stats.chainOnly += 1;
    else stats.wrong += 1;

    const stem = goldStem(g.classical);
    const reachable = segment(g.cyrillic).some((s) => sameWord(assemble(stem, s), g.classical));
    if (reachable) stats.oracle += 1;
    else {
      stats.unreachable += 1;
      if (collectMisses && misses.length < showMisses) {
        misses.push(`${g.cyrillic.padEnd(18)} ${g.classical}`);
      }
    }
  }
  return { stats, byTier, misses, n: gold.length };
}

function report(title, { stats, byTier, misses, n }, { full = true } = {}) {
  const row = (label, v) =>
    `  ${label.padEnd(28)} ${String(v).padStart(5)}   ${((100 * v) / n).toFixed(1).padStart(5)}%`;

  console.log(`\n${title}: ${n}\n`);
  console.log(row('EMITTED  candidates[0]', stats.emitted));
  console.log(row('best segmented', stats.top1));
  if (!full) return;
  console.log(row('chain right, stem wrong', stats.chainOnly));
  console.log(row('chain wrong', stats.wrong));
  console.log(row('no segmented reading', stats.none));
  console.log(`\n${row('ORACLE (perfect stem)', stats.oracle)}`);
  console.log(row('unreachable — real gaps', stats.unreachable));

  console.log('\nbest-segmented, by where the stem came from:');
  for (const [name, [hit, seen]] of Object.entries(byTier)) {
    if (seen === 0) continue;
    const share = ((100 * hit) / seen).toFixed(1).padStart(5);
    console.log(
      `  ${name.padEnd(10)} ${String(hit).padStart(4)} / ${String(seen).padStart(4)}   ${share}%`,
    );
  }

  if (misses.length > 0) {
    console.log('\n--- unreachable samples (suffix table / segmenter gaps) ---');
    for (const m of misses) console.log(`  ${m}`);
  }
}

/**
 * Three denominators, printed side by side and never merged into one headline.
 *
 * `detached gold forms` is the historical number and keeps its exact name and
 * denominator (1,611), because every figure recorded in `docs/` and the
 * CHANGELOG was measured against it and a comparison must stay possible.
 *
 * `attached gold forms` (273) used to be excluded from this script entirely,
 * which is how a whole class could sit at 0.0% without showing up anywhere. It
 * is scored from 2026-08-10, when the adjective-forming `-тай³` reading was
 * added — see the `-тай³` block in `data/suffixes.ts`.
 *
 * The two do **not** move together, and reporting either alone misleads in a
 * predictable direction: the detached half is the half where offering only the
 * дагуулж reading was right by construction, so a change that adds the залгаж
 * reading must cost something there and gain more on the other half. Read the
 * whole-fixture line for the net, and read the two halves for the trade.
 */
/**
 * Kept rather than discarded because `--sentences` builds its per-tier rates
 * from THIS run's scoring — the detached half, which is the set every figure in
 * the README's table is measured over.
 */
const detachedResult = evaluate(detachedGold, { collectMisses: true });
report('detached gold forms', detachedResult);
report('attached gold forms', evaluate(attachedGold));
report('WHOLE fixture (both halves)', evaluate(allGold), { full: false });

/**
 * Real running text, as sentences of Cyrillic. Shared by `--coverage` and
 * `--sentences` so the two always report over the identical sample.
 *
 * The corpus is on disk only — the script that produced it is gone — so a
 * missing file is a skip, never a failure.
 */
const CORPUS = resolve(ROOT, '.tmp/harvest-sentences.jsonl');
const CORPUS_LIMIT = 3000;

function* corpusSentences() {
  for (const line of readFileSync(CORPUS, 'utf8').split('\n').slice(0, CORPUS_LIMIT)) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const text = entry.cyrillic ?? entry.text ?? '';
    if (text) yield text;
  }
}

const needCorpus = (flag) => {
  if (existsSync(CORPUS)) return true;
  console.log(`\n${flag} needs .tmp/harvest-sentences.jsonl — not present, skipping`);
  return false;
};

if (process.argv.includes('--coverage') && needCorpus('--coverage')) {
  const counts = { lexicon: 0, harvested: 0, toli: 0, guess: 0, none: 0 };
  let toks = 0;
  for (const text of corpusSentences()) {
    for (const a of analyze(text)) {
      if (a.token.kind !== 'word') continue;
      toks += 1;
      const winner = a.candidates[0];
      if (winner === undefined) counts.none += 1;
      else counts[winner.provenance] += 1;
    }
  }
  const share = (v) => `${((100 * v) / toks).toFixed(1)}%`;
  console.log(`\ncoverage over ${toks} word tokens of real running text:`);
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(10)} ${String(v).padStart(6)}   ${share(v).padStart(6)}`);
  }
  // Everything that is not a guess is attested by some source.
  const real = counts.lexicon + counts.harvested + counts.toli;
  console.log(
    `  ${'REAL DATA'.padEnd(10)} ${String(real).padStart(6)}   ${share(real).padStart(6)}`,
  );
}

if (process.argv.includes('--sentences') && needCorpus('--sentences')) {
  /**
   * Per-word top-1 by tier, taken from THIS run's gold scoring rather than
   * hardcoded, so the estimate below cannot drift away from the measurement it
   * is built on.
   */
  const tierTop1 = Object.fromEntries(
    Object.entries(detachedResult.byTier).map(([name, [hit, seen]]) => [
      name,
      seen === 0 ? 0 : hit / seen,
    ]),
  );
  tierTop1.none = 0;

  const guessBuckets = new Map();
  const lenBuckets = new Map();
  const lengths = [];
  let sentences = 0;
  let clean = 0;
  let expectedExact = 0;

  for (const text of corpusSentences()) {
    let words = 0;
    let guessed = 0;
    let p = 1;
    for (const a of analyze(text)) {
      if (a.token.kind !== 'word') continue;
      words += 1;
      const tier = a.candidates[0]?.provenance ?? 'none';
      if (tier === 'guess' || tier === 'none') guessed += 1;
      p *= tierTop1[tier];
    }
    if (words === 0) continue;

    sentences += 1;
    lengths.push(words);
    if (guessed === 0) clean += 1;
    expectedExact += p;

    const gk = guessed >= 3 ? '3+' : String(guessed);
    guessBuckets.set(gk, (guessBuckets.get(gk) ?? 0) + 1);

    const lk = words <= 5 ? '1-5' : words <= 10 ? '6-10' : words <= 20 ? '11-20' : '21+';
    const b = lenBuckets.get(lk) ?? { n: 0, clean: 0, exp: 0 };
    b.n += 1;
    if (guessed === 0) b.clean += 1;
    b.exp += p;
    lenBuckets.set(lk, b);
  }

  lengths.sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)];
  const pct = (v, d = sentences) => `${((100 * v) / d).toFixed(1)}%`;

  console.log(`\nper SENTENCE over ${sentences} sentences of real running text`);
  console.log(`median length: ${median} words\n`);

  console.log('  sentences by number of guessed (unknown) stems:');
  for (const k of ['0', '1', '2', '3+']) {
    const v = guessBuckets.get(k) ?? 0;
    console.log(`    ${k.padEnd(3)} ${String(v).padStart(5)}   ${pct(v).padStart(6)}`);
  }

  // The ceiling is a measurement, not a model: a guessed stem converts
  // correctly ~4% of the time, so a sentence containing one is ~certainly
  // wrong. The estimate multiplies per-tier rates and so assumes independence,
  // which is optimistic — errors cluster in hard sentences. Read it as an
  // upper bound, and the gap between the two rows as the modelling risk.
  console.log(`\n  ${'CEILING  every stem from real data'.padEnd(36)} ${pct(clean).padStart(6)}`);
  console.log(`  ${'ESTIMATE exact whole sentence'.padEnd(36)} ${pct(expectedExact).padStart(6)}`);

  console.log('\n  by sentence length:');
  console.log(`    ${'len'.padEnd(7)} ${'n'.padStart(5)}   ceiling   est.`);
  for (const k of ['1-5', '6-10', '11-20', '21+']) {
    const b = lenBuckets.get(k);
    if (b === undefined) continue;
    console.log(
      `    ${k.padEnd(7)} ${String(b.n).padStart(5)}    ${pct(b.clean, b.n).padStart(6)}   ${pct(b.exp, b.n).padStart(6)}`,
    );
  }
}
