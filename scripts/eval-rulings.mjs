#!/usr/bin/env node
/**
 * Score the pipeline — and optionally a model — against the bichig reader's
 * verdicts in `test/rulings.test.ts`.
 *
 * ## Why this is a separate metric and not a line in eval-model.mjs
 *
 * `docs/neural-model.md` gives two rules for anyone picking the model up, and
 * the first is **score against `rulings.test.ts` separately, every run**. The
 * reason is on the record: the first training run scored a respectable 49.6%
 * while reproducing all three of the reader's rulings *wrongly*, because the
 * export had skipped `normalizeOrthography`. Aggregate accuracy could not see
 * it — the model looked like it was working. A metric that averages over 1,768
 * forms cannot notice that the eight that came from a human are all wrong.
 *
 * These are the only expectations in the suite that come from a person rather
 * than from another converter, so a disagreement here outranks a disagreement
 * anywhere else regardless of what the harvest says.
 *
 * ## Where the pairs come from
 *
 * Parsed out of the test file rather than kept in a fixture, so the two cannot
 * drift: the assertion a reader ruled on *is* the thing scored. `same(cyrillic,
 * classical)` is the confirmed set. `it.todo('cyrillic → classical')` is the
 * known-wrong set — cases the reader gave that we do not yet produce — and they
 * are scored separately because getting one right is news and getting one wrong
 * is the status quo.
 *
 * A `todo` whose text is prose rather than a romanization ('converb,
 * romanization unconfirmed') is skipped: there is nothing to compare against.
 *
 * Usage:
 *   node scripts/eval-rulings.mjs
 *   node scripts/eval-rulings.mjs --preds .tmp/model-preds-v3.tsv
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const PREDS = flag('--preds', null);
const RULINGS = resolve(ROOT, 'test/rulings.test.ts');

if (!existsSync(resolve(ROOT, 'dist/index.js'))) {
  console.error('needs a build first: pnpm build');
  process.exit(1);
}

const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { analyze, convert } = await load('dist/index.js');
const { toScript } = await load('dist/romanize.js');

/**
 * The hybrid takes the pipeline's answer unless the pipeline would *guess*, in
 * which case it takes the model's. Scoring it here matters more than anywhere
 * else: the model breaks a large share of the reader's confirmed verdicts on
 * its own, and reporting only that number would read as "the model regresses
 * the rulings" when the arrangement that would actually ship never asks it.
 * The reader's verdicts live in `lexicon.ts`, so the pipeline answers almost
 * all of them from a dictionary and the model is never consulted.
 */
const wouldGuess = (cyrillic) =>
  (analyze(cyrillic)[0]?.candidates[0]?.provenance ?? 'none') === 'guess';

const source = readFileSync(RULINGS, 'utf8');

/**
 * Deduplicate by (cyrillic, classical). Four words are asserted twice — аваад,
 * судлаж, авна and шар each appear under two rulings, which is right for a test
 * file and wrong for a metric: counting шар twice quietly gives one word double
 * the weight of every other verdict the reader gave.
 */
const dedupe = (entries) => {
  const seen = new Set();
  return entries.filter((e) => {
    const k = `${e.cyrillic}\t${e.classical}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** `same('ажлаас', 'aǰil-ača')` — a verdict the converter is expected to match. */
const confirmed = dedupe(
  [...source.matchAll(/same\(\s*'([а-яөүёА-ЯӨҮЁ]+)'\s*,\s*'([^']+)'\s*\)/g)].map((m) => ({
    cyrillic: m[1].toLowerCase(),
    classical: m[2],
  })),
);

/** `it.todo('хийж → kiǰü')` — a verdict we are known to fail. */
const todo = dedupe(
  [...source.matchAll(/it\.todo\(\s*'([а-яөүёА-ЯӨҮЁ]+)\s*→\s*([^']+)'\s*\)/g)].map((m) => ({
    cyrillic: m[1].toLowerCase(),
    classical: m[2].trim(),
  })),
)
  // Prose, not a romanization — 'converb, romanization unconfirmed' and the
  // like. Nothing to compare against, and guessing at one would invent a
  // ruling the reader never gave.
  .filter((e) => !/[ ,(]/.test(e.classical));

const preds = new Map();
if (PREDS) {
  if (!existsSync(PREDS)) {
    console.error(`missing ${PREDS}`);
    process.exit(1);
  }
  for (const line of readFileSync(PREDS, 'utf8').split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    preds.set(line.slice(0, tab).toLowerCase(), line.slice(tab + 1).trim());
  }
}

/**
 * Graded in SCRIPT. γ/g and q/k are harmony-selected allographs of one letter,
 * so `ger` and `γer` are byte-identical output — comparing romanizations
 * invents disagreements, which is footgun 1 in CLAUDE.md.
 */
function score(entries, label) {
  let pipelineOk = 0;
  let modelOk = 0;
  let hybridOk = 0;
  let asked = 0;
  let scored = 0;
  const rows = [];

  for (const e of entries) {
    let want;
    try {
      want = toScript(e.classical);
    } catch {
      // A romanization our own generator refuses is a data problem in the test
      // file, not a converter failure — say so rather than counting it wrong.
      rows.push({ ...e, skipped: true });
      continue;
    }
    scored += 1;
    const got = convert(e.cyrillic);
    const model = preds.get(e.cyrillic);
    const p = got === want;
    const m = model === undefined ? null : model === want;
    const guessing = wouldGuess(e.cyrillic);
    if (guessing) asked += 1;
    // Model only where the pipeline would guess; the pipeline's own answer
    // everywhere else. With no --preds this degenerates to the pipeline.
    const h = PREDS && guessing ? m === true : p;
    if (p) pipelineOk += 1;
    if (m) modelOk += 1;
    if (h) hybridOk += 1;
    rows.push({ ...e, want, got, model, p, m, h, guessing });
  }

  const pct = (n) => (scored ? `${((n / scored) * 100).toFixed(1)}%` : '—');
  console.log(`\n${label} — ${scored} scored${PREDS ? '' : ' (pipeline only)'}`);
  console.log(`  pipeline  ${String(pipelineOk).padStart(3)}/${scored}  ${pct(pipelineOk)}`);
  if (PREDS) {
    console.log(`  model     ${String(modelOk).padStart(3)}/${scored}  ${pct(modelOk)}`);
    console.log(
      `  hybrid    ${String(hybridOk).padStart(3)}/${scored}  ${pct(hybridOk)}` +
        `   (model consulted on ${asked} of ${scored})`,
    );
  }

  const skipped = rows.filter((r) => r.skipped);
  if (skipped.length) {
    console.log(`  skipped   ${skipped.length} (romanization our generator refuses)`);
  }
  return rows;
}

const confirmedRows = score(confirmed, 'CONFIRMED by the reader');
const todoRows = score(todo, 'KNOWN WRONG (it.todo)');

// The interesting rows are the ones where the two disagree: a model that fixes
// a reader-ruled failure is the single most valuable thing it can do, and one
// that breaks a reader-confirmed pass is the single worst.
if (PREDS) {
  const broke = confirmedRows.filter((r) => !r.skipped && r.p && r.m === false);
  const fixed = todoRows.filter((r) => !r.skipped && !r.p && r.m === true);

  if (fixed.length) {
    console.log(`\nthe model FIXED ${fixed.length} the pipeline still gets wrong:`);
    for (const r of fixed) console.log(`  ${r.cyrillic}  → ${r.classical}`);
  }
  if (broke.length) {
    console.log(`\nthe model BREAKS ${broke.length} the pipeline gets right:`);
    for (const r of broke) console.log(`  ${r.cyrillic}  should be ${r.classical}`);
  }
  if (!fixed.length && !broke.length) {
    console.log('\nno reader-ruled row where the model and the pipeline differ in outcome.');
  }
}
