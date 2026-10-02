#!/usr/bin/env node
/**
 * Score a trained model against the gold set, broken down by the tier the
 * PIPELINE would have used — and score the hybrid of the two.
 *
 * ## Why this exists as a script rather than as a one-off
 *
 * The headline table in `docs/neural-model.md` §1b (harvested 61.9/58.5,
 * lexicon 64.2/47.6, guess 0.0/42.1, hybrid 59.4) was computed ad hoc on
 * 2026-07-27 and could not be regenerated, which makes it an anecdote rather
 * than a measurement. Any claim that a later model is better has to be made
 * against the same numbers computed the same way.
 *
 * ## The comparison that matters is per tier, not overall
 *
 * Overall accuracy is close to meaningless here: the model and the pipeline
 * fail on disjoint sets. The pipeline wins wherever a dictionary reaches and
 * scores **zero** where it falls back to guessing; the model is mediocre
 * everywhere and merely non-zero on that slice. Averaging hides both facts. The
 * decision this table informs — put the model *below* the dictionaries, firing
 * only where the pipeline would guess — follows from the per-tier split.
 *
 * `hybrid` is that decision scored directly: take the pipeline's answer unless
 * its provenance is `guess`, in which case take the model's.
 *
 * ## Grading is in SCRIPT
 *
 * γ/g and q/k are harmony-selected allographs of one letter, so `ger` and
 * `γer` are the same word and identical code points. Comparing romanizations
 * invents disagreements — it once scored the curated lexicon at 56% when the
 * real figure was 83%. Gold is stored as romanization and is decoded here; the
 * model already emits code points.
 *
 * Usage:
 *   # on the training box
 *   cut -f1 data/test.jsonl-derived words | python3 convert.py --model model/model.pt > preds.tsv
 *   # here
 *   node scripts/eval-model.mjs --preds preds.tsv
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { emptyAttested } from './lib/derivation.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const PREDS = flag('--preds', '.tmp/model-preds.tsv');
const GOLD = flag('--gold', 'test/fixtures/harvested-inflected.json');

if (!existsSync(PREDS)) {
  console.error(`missing ${PREDS}
Generate it on the training box:
  cut -f1 gold-words.txt | .venv/bin/python convert.py --model model/model.pt > preds.tsv`);
  process.exit(1);
}

const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { analyze } = await load('dist/index.js');
const { toScript } = await load('dist/romanize.js');
// A gold fixture measures derivation, so the attested tier is emptied for the
// whole run — see `lib/derivation.mjs`.
await emptyAttested(ROOT);

const gold = JSON.parse(readFileSync(resolve(ROOT, GOLD), 'utf8')).entries;

/** cyrillic → predicted script. */
const preds = new Map();
for (const line of readFileSync(PREDS, 'utf8').split('\n')) {
  if (!line.replace(/[ \n\r\t]/g, '')) continue;
  const tab = line.indexOf('\t');
  if (tab < 0) continue;
  preds.set(line.slice(0, tab).toLowerCase(), line.slice(tab + 1));
}

// Every `Provenance` value plus `none`, in tier order. ⚠ A missing value here
// is a crash, not a silent zero row — `byTier[tier]` is undefined and the
// accumulate throws. That is the right failure: this script existed for two
// weeks after `toli` landed and would otherwise have quietly scored the whole
// tier as if it were something else. Add the tier when `Provenance` grows.
const TIERS = ['lexicon', 'attested', 'harvested', 'toli', 'guess', 'none'];
const zero = () => ({ n: 0, pipeline: 0, model: 0, hybrid: 0 });
const byTier = Object.fromEntries(TIERS.map((t) => [t, zero()]));
/** Only populated by fixtures that carry a `group`, i.e. the verb gold set. */
const byGroup = new Map();
const all = zero();

let missingPrediction = 0;

for (const entry of gold) {
  const cyrillic = entry.cyrillic.toLowerCase();
  // Two fixture shapes. `harvested-inflected.json` stores only Classical, so it
  // is decoded; `verb-gold.json` stores the script directly and it is
  // authoritative — a form that does not round-trip through romanization still
  // has a correct answer, and dropping it would quietly bias the set toward the
  // forms romanization happens to handle.
  const want = entry.script ?? toScript(entry.classical);

  const winner = analyze(entry.cyrillic)[0]?.candidates?.[0];
  const tier = winner?.provenance ?? 'none';
  const pipelineOut = winner?.script ?? '';

  const modelOut = preds.get(cyrillic);
  if (modelOut === undefined) missingPrediction += 1;

  // The hybrid is the actual proposed architecture: dictionaries win outright,
  // and the model is consulted only where the pipeline would have guessed.
  //
  // ⚠ `toli` is deliberately NOT in this test, and the reasoning is the
  // opposite of CLAUDE.md's "exclude toli by name" rule rather than an
  // exception to it. That rule is about gates asking "do we already have a
  // real reading" — there a toli hit must not suppress a better path. Here the
  // question is "has a dictionary answered", and toli has: it scores ~70% on
  // gold where it fires against the guesser's ~8%, so handing its slice to the
  // model would be a demotion on the current numbers. The `toli` row in the
  // table below prints model and pipeline side by side on exactly that slice,
  // so this stays a measured decision and not an assumed one — flip it only if
  // that row says to.
  const usesModel = tier === 'guess' || tier === 'none';
  const hybridOut = usesModel ? (modelOut ?? pipelineOut) : pipelineOut;

  if (entry.group && !byGroup.has(entry.group)) byGroup.set(entry.group, zero());

  for (const bucket of [byTier[tier], all, ...(entry.group ? [byGroup.get(entry.group)] : [])]) {
    bucket.n += 1;
    if (pipelineOut === want) bucket.pipeline += 1;
    if (modelOut === want) bucket.model += 1;
    if (hybridOut === want) bucket.hybrid += 1;
  }
}

const pct = (a, b) => (b === 0 ? '   —  ' : `${((100 * a) / b).toFixed(1)}%`.padStart(6));
const WIDTH = 22;
const row = (name, s) =>
  `${name.padEnd(WIDTH)} ${String(s.n).padStart(5)}   ${pct(s.pipeline, s.n)}   ${pct(s.model, s.n)}   ${pct(s.hybrid, s.n)}`;

const RULE = '-'.repeat(WIDTH + 35);
console.log(`${GOLD}\n${gold.length} forms, graded in SCRIPT\n`);
const header = `${'tier'.padEnd(WIDTH)} ${'n'.padStart(5)}   ${'pipe'.padStart(6)}   ${'model'.padStart(6)}   ${'hybrid'.padStart(6)}`;
console.log(header);
console.log(RULE);
for (const t of TIERS) if (byTier[t].n > 0) console.log(row(t, byTier[t]));
console.log(RULE);
console.log(row('all', all));

// Per morphological group, for a fixture that carries them. Each ending is a
// separate rule, and a model can be strong on one and dead on another while
// landing on a respectable average — which is the whole reason the verb set is
// stratified rather than randomly sampled.
if (byGroup.size > 0) {
  console.log(
    `\n${'group'.padEnd(WIDTH)} ${'n'.padStart(5)}   ${'pipe'.padStart(6)}   ${'model'.padStart(6)}   ${'hybrid'.padStart(6)}`,
  );
  console.log(RULE);
  for (const [g, s] of [...byGroup].sort((a, b) => b[1].n - a[1].n)) console.log(row(g, s));
}

if (missingPrediction > 0) {
  console.log(
    `\n${missingPrediction} gold words had no model prediction — hybrid fell back to the pipeline for those.`,
  );
}

// The `guess` slice is the whole argument for the model existing, so it gets
// stated rather than left to be read off the table.
const g = byTier.guess;
if (g.n > 0) {
  console.log(
    `\nguess slice: pipeline ${pct(g.pipeline, g.n).trim()}, model ${pct(g.model, g.n).trim()} over ${g.n} forms` +
      ' — this is the number the model exists to move.',
  );
}
