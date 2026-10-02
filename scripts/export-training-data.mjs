#!/usr/bin/env node
/**
 * Export word-level training pairs for the neural model — see docs/neural-model.md.
 *
 * Target is **Unicode code points, not romanization**. Romanization is not
 * canonical (q/k and γ/g are harmony-selected allographs of one letter, so
 * 72.9% of harvest rows have more than one valid spelling of the identical
 * output) and not total (seven galig letters and the space have no
 * romanization at all, which is what quarantines 1,638 rows). Both problems
 * disappear when the target is the script itself.
 *
 * ## The split is the only thing here that must not be got wrong
 *
 * Every one of the 1,768 gold keys in `test/fixtures/harvested-inflected.json`
 * is also present in the raw harvest, so training on the harvest unfiltered
 * leaks the entire test set. A leak is not detectable after the fact, only
 * suspected — so held-out keys are removed by *Cyrillic surface form*, which
 * also drops any other inflection of the same word that happens to collide.
 *
 * Shuffling uses a seeded PRNG rather than Math.random, so re-running this
 * reproduces byte-identical files and a later run cannot silently reshuffle a
 * word from test into train.
 *
 * Usage: node scripts/export-training-data.mjs [outDir]   (default .tmp/training)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toScript } from '@gege-mn/mongol-bichig';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// `src/orthography.ts` cannot be imported directly: node strips its types but
// does not rewrite its specifiers, so `./data/suffixes.js` resolves to a file
// that only exists in `dist/`. This script was left unrunnable for a day when
// `attachDetachedSuffix` gave orthography.ts its first local import — and an
// export script that does not run is a training run that silently reuses stale
// data. Read the build, and say so plainly when it is missing.
if (!fs.existsSync(path.resolve(ROOT, 'dist/orthography.js'))) {
  console.error('needs a build first: pnpm build');
  process.exit(1);
}
const { scriptOf } = await import(pathToFileURL(path.resolve(ROOT, 'scripts/lib/silver.mjs')).href);

const OUT_DIR = process.argv[2] ?? '.tmp/training';
const HARVEST = '.tmp/harvest-harvest.jsonl';
const QUARANTINE = '.tmp/harvest-quarantine.jsonl';
const ALIGNED = '.tmp/aligned-words.jsonl';
const GOLD = 'test/fixtures/harvested-inflected.json';
const VERB_GOLD = 'test/fixtures/verb-gold.json';
const RULINGS = 'test/rulings.test.ts';
const SEED = 20260727;
const VAL_FRACTION = 0.05;

/** Deterministic PRNG (mulberry32) — reproducibility is the point. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const readJsonl = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));

// ---- sources -------------------------------------------------------------

const harvest = readJsonl(HARVEST);

// The quarantine holds rows gege-linter repaired successfully but romanization
// then refused. They carry correct `unicode`, so a code-point target recovers
// every one of them. Rows quarantined for anything else stay out.
const recovered = readJsonl(QUARANTINE).filter(
  (r) => (r.reason ?? '').startsWith('romanize:') && (r.unicode ?? '').length > 0,
);

/**
 * Word pairs recovered from the 4,000 parallel *sentences* by
 * `scripts/align-sentences.mjs`. These matter out of proportion to their count:
 * the word harvest was built from a lemma dictionary and therefore contains
 * almost no inflected verbs, which is the whole reason verbs are the pipeline's
 * categorical hole. Running text supplies them — including the `-ж/-ч` and
 * `-аад/-ээд` converbs that `src/data/verb-suffixes.ts` records as having zero
 * to near-zero attestation and refuses to guess.
 *
 * Alignment is anchor-verified against the word harvest and measured at 95.3%
 * by leave-one-out; a bichig reader then ruled 28/28 of a stratified sample
 * correct on 2026-07-27 before any of it was trained on. Optional, so the
 * export still runs on a checkout that has not aligned yet.
 */
const aligned = fs.existsSync(ALIGNED)
  ? readJsonl(ALIGNED).map((r) => ({ cyrillic: r.cyrillic, unicode: r.script }))
  : [];

const gold = JSON.parse(fs.readFileSync(GOLD, 'utf8')).entries;

/**
 * The held-out verb gold set, carved out of the same aligned pairs read above —
 * so without this removal every one of its 197 forms would be trained on, and
 * the only metric that can see verbs at all would be scoring memorisation.
 *
 * `harvested-inflected.json` has 2 verb-shaped forms in 1,768, which is why a
 * second fixture exists rather than an extension of the first.
 */
const verbGold = fs.existsSync(VERB_GOLD)
  ? JSON.parse(fs.readFileSync(VERB_GOLD, 'utf8')).entries
  : [];

/**
 * Cyrillic words appearing anywhere in test/rulings.test.ts — a bichig reader's
 * verdicts, and the highest-authority fixture in the suite.
 *
 * Every Cyrillic run is taken, not just fully-Cyrillic quoted strings. The
 * earlier `/'[а-яөүё]+'/` matched only a quoted string that is Cyrillic *end to
 * end*, so it silently missed the `it.todo` cases, which are written
 * `it.todo('хийж → kiǰü')` — the arrow and the romanization break the match.
 * Those are exactly the known-wrong words whose held-out status matters most,
 * and хийж duly leaked into train the moment sentence alignment supplied it.
 *
 * Over-holding is the safe direction: a Cyrillic word mentioned only in a
 * comment costs a training row, while a missed one silently invalidates the
 * metric it was supposed to protect.
 */
const rulingsWords = new Set(
  (fs.readFileSync(RULINGS, 'utf8').match(/[а-яөүёА-ЯӨҮЁ]{2,}/g) ?? []).map((s) => s.toLowerCase()),
);

// ---- held-out keys -------------------------------------------------------

const heldOut = new Set([
  ...gold.map((e) => e.cyrillic.toLowerCase()),
  ...verbGold.map((e) => e.cyrillic.toLowerCase()),
  ...rulingsWords,
]);

// ---- pairs ---------------------------------------------------------------

// `unicode` is gege-linter's *encoding* repair only. The orthographic layer is
// separate and must be applied here too, or the model learns the silver
// converter's spelling rather than this project's.
//
// This is not theoretical. A first run trained on un-normalised targets
// reproduced all three of the bichig reader's rulings *wrongly* — монгол as
// ᠮᠣᠩᠭᠣᠯ instead of ᠮᠣᠩᠭᠤᠯ, сайн as `sayin` instead of `sain`, найм without
// its FVS1 — because 7/7 монгол rows and 35/35 сай rows in the raw harvest
// carry the older convention. The model was faithful; the data was wrong.
//
// A `repairDevoicedGa` pass was added here 2026-07-29 for the same reason and
// **withdrawn 2026-07-31**: the 2026 rulebook's rule 2.1.2.3 says the harvest's
// ХА after a д/с дэвсгэр was correct all along, so the repair was teaching the
// model an error rather than fixing one. The lesson holds and the instance was
// wrong — which is itself worth leaving written down, because the reasoning that
// justified it ("a reader ruled on six words") looked identical to the reasoning
// that justified the two passes above, and only a source of higher standing
// could tell them apart.
const seen = new Set();
const pairs = [];
for (const row of [...harvest, ...recovered, ...aligned]) {
  const src = (row.cyrillic ?? '').toLowerCase();
  const tgt = scriptOf(row);
  if (src.length === 0 || tgt.length === 0) continue;
  if (heldOut.has(src)) continue;
  const key = `${src}\t${tgt}`;
  if (seen.has(key)) continue;
  seen.add(key);
  pairs.push({ src, tgt });
}

// The gold set is romanization, so it is decoded here — the one place toScript
// is still load-bearing, and it is exact: all 1,768 entries romanize cleanly.
const test = gold.map((e) => ({ src: e.cyrillic.toLowerCase(), tgt: toScript(e.classical) }));

// ---- split ---------------------------------------------------------------

const random = rng(SEED);
const shuffled = [...pairs];
for (let i = shuffled.length - 1; i > 0; i -= 1) {
  const j = Math.floor(random() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
const valCount = Math.round(shuffled.length * VAL_FRACTION);
const val = shuffled.slice(0, valCount);
const train = shuffled.slice(valCount);

// ---- leak check ----------------------------------------------------------
// Belt and braces: assert what the filter above was supposed to guarantee.
// This is cheap, and the failure it catches is otherwise invisible.

// Both fixtures, not just the noun one. The verb set is carved out of the same
// aligned pairs that feed training, so it is the likelier of the two to leak.
const testKeys = new Set([
  ...test.map((p) => p.src),
  ...verbGold.map((e) => e.cyrillic.toLowerCase()),
]);
const leaked = [...train, ...val].filter((p) => testKeys.has(p.src));
if (leaked.length > 0) {
  console.error(`LEAK: ${leaked.length} test keys found in train/val, e.g. ${leaked[0].src}`);
  process.exit(1);
}

// ---- write ---------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true });
const write = (name, rows) =>
  fs.writeFileSync(
    path.join(OUT_DIR, name),
    `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`,
    'utf8',
  );

write('train.jsonl', train);
write('val.jsonl', val);
write('test.jsonl', test);

const charsIn = new Set(pairs.flatMap((p) => [...p.src]));
const charsOut = new Set(pairs.flatMap((p) => [...p.tgt]));

fs.writeFileSync(
  path.join(OUT_DIR, 'manifest.json'),
  `${JSON.stringify(
    {
      generatedBy: 'scripts/export-training-data.mjs',
      seed: SEED,
      counts: {
        harvest: harvest.length,
        recoveredFromQuarantine: recovered.length,
        sentenceAligned: aligned.length,
        afterDedupAndHoldout: pairs.length,
        train: train.length,
        val: val.length,
        test: test.length,
      },
      heldOutKeys: heldOut.size,
      vocab: { source: charsIn.size, target: charsOut.size },
      target: 'unicode-code-points',
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`harvest                    ${harvest.length}`);
console.log(`recovered from quarantine  +${recovered.length}`);
console.log(`sentence-aligned           +${aligned.length}  (reader-sampled 28/28)`);
console.log(`held-out keys removed      -${heldOut.size} (gold + rulings)`);
console.log(`after dedup                ${pairs.length}`);
console.log('');
console.log(`train  ${train.length}`);
console.log(`val    ${val.length}`);
console.log(`test   ${test.length}  (gold, never trained on — leak check passed)`);
console.log('');
console.log(`vocab  ${charsIn.size} source chars, ${charsOut.size} target chars`);
console.log(`→ ${OUT_DIR}`);
