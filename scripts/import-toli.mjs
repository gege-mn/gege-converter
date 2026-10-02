#!/usr/bin/env node
/**
 * Import the `toli` stem tier from a bundled SQLite dictionary.
 *
 *   node scripts/import-toli.mjs [out.ts] [--db PATH] [--tsv PATH]
 *
 * The source is a dictionary app's bundled asset: ~52k single-word headwords,
 * each with a `tolgoi_ug_hudam_galig` column that is already written in this
 * project's own romanization. That is what makes it importable at all —
 * rendering the galig with our `toScript` applies our conventions for free,
 * where the database's own hudum column carries its.
 *
 * ⚠ The database is NOT in this repo and never will be. Point `--db` at it.
 *
 * ⚠ SQLite's built-in `lower()` is ASCII-only and silently leaves Cyrillic
 * uppercase. Every headword in this source is uppercase, so lowercasing in SQL
 * produces keys that match nothing — a run that looks successful and imports a
 * tier that can never be hit. Case folding happens in JS, below.
 *
 * WHY THIS IS A FOURTH TIER AND NOT MORE HARVESTED ROWS
 *
 * Measured 2026-08-10, before the filters below existed: merged into the
 * `harvested` tier at the harvested prior, this source BROKE SEVEN of the
 * reader's confirmed rulings. Not because its Classical forms are wrong —
 * because 45k new short stems invent segmentations that outrank the right
 * ones. хэлэнд became `qeleng-dü` instead of `kele-dü` (the source lists хэлэн
 * as its own headword), аваад became аваа + д instead of ав + аад.
 *
 * Three things fix that, and all three are load-bearing:
 *   1. its own tier, below `harvested`, at TOLI_PRIOR
 *   2. consulted in `stem.ts` only AFTER every restoration path that uses
 *      curated or harvested data — an early return there destroys answers
 *      those paths already get right
 *   3. the derivable-headword filter below
 *
 * WHAT IS DELIBERATELY NOT USED
 *
 * The `tolgoi_ug_hudam` column. It carries the source's own conventions —
 * ᠮᠣᠩᠭᠣᠯ for монгол, сайн with the older V+y+i diphthong, the ᠶᠢ notation
 * UTN #57 ruled against — all of which a reader has already ruled against
 * here. The galig column plus our own `toScript` avoids every one of them.
 *
 * The lemma gate that `import-harvest.mjs` applies is also NOT used: those
 * lists total 12,691 words and the harvest already took all of them, so
 * applying it here keeps 17 rows out of 41,675. The whole value of this
 * source is the headwords no lemma list has.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { emptyAttested } from './lib/derivation.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};
const OUT = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];
const OUT_PATH = resolve(ROOT, OUT ?? 'src/data/toli-lexicon.ts');
// No default. The source database is not part of this repository and its path
// is a fact about one machine, not about the project — a default here would
// both fail confusingly for anyone else and bake a local layout into a public
// file. Pass it explicitly: `--db PATH`.
const DB = arg('--db');
if (DB === undefined) {
  console.error('need --db PATH — the SQLite dictionary to import from');
  process.exit(1);
}
const TSV = arg('--tsv');

const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { toScript, fromScript } = await load('dist/romanize.js');
const { normalizeOrthography } = await load('dist/orthography.js');
const { lexicon, harvestedIndex } = await load('dist/data/lexicon.js');
const { analyze } = await load('dist/index.js');
// The `derivable` gate below asks whether a real stem already derives a word.
// With the `attested` tier live, a whole-word row replaces its derived twin in
// the candidate list (`generate.ts`, isStronger), the derivation disappears from
// view, and the word is imported as a stem after all. So the tier is emptied
// for this run, as it is wherever a gold fixture is scored.
await emptyAttested(ROOT);

async function loadLinter() {
  for (const spec of [
    process.env.GEGE_LINTER,
    '@gege-mn/gege-linter',
    resolve(ROOT, '../gege-linter/dist/index.js'),
  ].filter(Boolean)) {
    const href = /^[./]|^[A-Za-z]:\\/.test(spec) ? pathToFileURL(resolve(spec)).href : spec;
    try {
      const mod = await import(href);
      if (typeof mod.lint === 'function') return mod.lint;
    } catch {
      // next
    }
  }
  console.error('could not load gege-linter');
  process.exit(1);
}
const lint = await loadLinter();

// ------------------------------------------------------------------- source

/** Headword + galig, one pair per line. Case folding is deliberately not SQL's. */
const QUERY =
  'select distinct trim(tolgoi_ug), trim(tolgoi_ug_hudam_galig) from main ' +
  'where tolgoi_ug is not null and tolgoi_ug_hudam_galig is not null ' +
  "and trim(tolgoi_ug_hudam_galig) != '' and trim(tolgoi_ug) not like '% %';";

let raw;
if (TSV) {
  raw = readFileSync(resolve(TSV), 'utf8');
} else {
  if (!existsSync(DB)) {
    console.error(`no database at ${DB} — pass --db PATH or --tsv PATH`);
    process.exit(1);
  }
  raw = execFileSync('sqlite3', ['-separator', '\t', DB, QUERY], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

const pairs = raw
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\t'))
  .filter((p) => p.length === 2 && p[0] && p[1]);

// -------------------------------------------------------------------- filters

const curated = new Set(lexicon.map((e) => e.cyrillic));

/**
 * Every held-out key, from ALL THREE fixtures — not just the noun gold set.
 *
 * ⚠ This read `harvested-inflected.json` alone until 2026-08-10, and the two
 * fixtures it was missing are the two that matter most. The shipped tier
 * carried **10 verb-gold forms** (аж, давсан, дэнж, өнө, унадаг, ууж, хуурч,
 * цаана, шарж, эсвэл) and six reader-ruled words. That is memorisation of the
 * test set by the runtime, and it was inflating exactly the metric this
 * project uses to argue the model is still needed: verb gold read 53.3% with
 * the leak and 51.9% without it, and the `toli` tier's share of that fixture
 * fell from 7 forms to 1 once the leak was removed. Nearly the whole
 * "toli scores 85.7% on verbs" claim was the fixture reading itself back.
 *
 * The noun gold set showed **zero** collisions, which is why this went
 * unnoticed — the one fixture that was checked was the one with nothing to
 * find. A holdout filter that has never rejected anything is not known to
 * work; this one rejected nothing for the sets it did not read.
 *
 * `rulings.test.ts` is scraped for every Cyrillic run of length ≥2, matching
 * `scripts/export-training-data.mjs`. That over-matches — it picks up suffix
 * fragments like `ийн` and `сэн` out of test prose — and over-matching is the
 * correct direction for a holdout: a few dozen extra headwords withheld costs
 * nothing against a 40k tier, while one leaked ruling silently corrupts the
 * highest-authority fixture in the suite.
 *
 * That trade was measured rather than assumed, because the narrower gate was
 * the tempting choice: scraping the rulings withholds **26 further rows** out
 * of 41,666, and the known-stem accuracy on the noun gold set is identical to
 * four decimal places either way (0.7360). The over-match is free.
 */
const goldForms = new Set([
  ...JSON.parse(
    readFileSync(resolve(ROOT, 'test/fixtures/harvested-inflected.json'), 'utf8'),
  ).entries.map((g) => g.cyrillic.toLowerCase()),
  ...JSON.parse(readFileSync(resolve(ROOT, 'test/fixtures/verb-gold.json'), 'utf8')).entries.map(
    (g) => g.cyrillic.toLowerCase(),
  ),
  ...[
    ...readFileSync(resolve(ROOT, 'test/rulings.test.ts'), 'utf8').matchAll(/[а-яөүёА-ЯӨҮЁ]{2,}/g),
  ].map((m) => m[0].toLowerCase()),
]);

/**
 * A headword the tokenizer could never hand us is dead weight. Seven rows fail
 * this and each one says something about the source: `бонс(оо)` and `ян-йиг`
 * carry editorial notation, while `кепкa`, `хойшoo`, `чоноh` and `oвоолго` mix
 * Latin homoglyphs into Cyrillic — the same wrong-block look-alike defect
 * gege-linter flags on the script side, here on the Cyrillic one.
 */
const isCyrillicKey = (s) => /^[а-яёөү]+$/.test(s);

const stats = {
  rows: pairs.length,
  notCyrillic: 0,
  outranked: 0,
  heldOut: 0,
  derivable: 0,
  unromanizable: 0,
  normalized: 0,
  dirty: 0,
  roundTripFailed: 0,
  duplicate: 0,
  imported: 0,
};

const seen = new Set();
const accepted = [];

for (const [rawCyrillic, galig] of pairs) {
  const cyrillic = rawCyrillic.toLowerCase();
  if (galig.includes(' ')) continue;
  if (!isCyrillicKey(cyrillic)) {
    stats.notCyrillic += 1;
    continue;
  }

  // The tiers above own this key outright.
  if (curated.has(cyrillic) || harvestedIndex.has(cyrillic)) {
    stats.outranked += 1;
    continue;
  }
  // Holdout discipline: a gold surface form must never become a stem.
  if (goldForms.has(cyrillic)) {
    stats.heldOut += 1;
    continue;
  }
  // Not a stem if our own morphology already derives it from real data: аваа
  // is ав + аа, уйлаа is уйл + аа, хэлэн is хэл + н. This source lists such
  // forms as headwords, and adding one as a stem invents a segmentation that
  // outranks the right one. Three of the seven broken rulings were this.
  //
  // ⚠ Only `lexicon` and `harvested` count, NOT every non-guess tier. The
  // build this script imports from already contains the *previous* generation
  // of this file, so testing `!== 'guess'` lets the tier judge itself: rows
  // become derivable because earlier rows were imported, and each run shrinks
  // the file (41,679 → 39,362 on the first repeat). Naming the two tiers that
  // outrank this one makes the import idempotent.
  if (
    analyze(cyrillic)[0]?.candidates.some(
      (c) =>
        c.segmentation.suffixes.length > 0 &&
        (c.provenance === 'lexicon' || c.provenance === 'harvested'),
    )
  ) {
    stats.derivable += 1;
    continue;
  }

  let script;
  try {
    script = toScript(galig);
  } catch {
    stats.unromanizable += 1;
    continue;
  }

  // Same pass `import-harvest.mjs` applies, and for the same reason: the
  // galig is in our romanization but not in our orthography.
  const normed = normalizeOrthography(script);
  if (normed !== script) stats.normalized += 1;

  if (lint(normed).filter((d) => d.severity !== 'info').length > 0) {
    stats.dirty += 1;
    continue;
  }

  let classical;
  try {
    classical = fromScript(normed);
    if (toScript(classical) !== normed) {
      stats.roundTripFailed += 1;
      continue;
    }
  } catch {
    stats.roundTripFailed += 1;
    continue;
  }

  const key = `${cyrillic} ${classical}`;
  if (seen.has(key)) {
    stats.duplicate += 1;
    continue;
  }
  seen.add(key);
  accepted.push([cyrillic, classical]);
  stats.imported += 1;
}

accepted.sort((a, b) => a[0].localeCompare(b[0], 'mn') || a[1].localeCompare(b[1]));

// --------------------------------------------------------------------- emit

/**
 * One `cyrillic classical` pair per line, not one object literal per row.
 * At this size the object form is a 2.9 MB source file; this is under half
 * that, still exactly one auditable row per line, and still diffs per row.
 */
const header = `/**
 * Cyrillic → Classical stems from a bundled SQLite dictionary, romanized from
 * its galig column and orthographically normalised by \`src/orthography.ts\`.
 * GENERATED — do not edit by hand.
 *
 *   node scripts/import-toli.mjs --db PATH
 *
 * This is the \`toli\` provenance tier: the largest source here and the least
 * reviewed. It sits BELOW \`harvested\`, and \`stem.ts\` consults it only where
 * every other path — curated, harvested, and each restoration rule — has
 * already missed. It is the tier that answers where we would otherwise guess,
 * and nowhere else.
 *
 * Measured on the held-out inflected gold the day it landed: it scores ~69%
 * where it fires, against ~8% for the guesser it displaces. It is not close to
 * the curated tier and is not meant to be.
 *
 * ⚠ Unreviewed, and it disagrees with this project on documented points — it
 * is the source \`docs/rulings.md\` describes as a conflict queue. A word a
 * reader has ruled on belongs in \`lexicon.ts\`, which outranks this outright.
 *
 * ${accepted.length} entries, from ${stats.rows} source rows.
 */

/** \`cyrillic classical\`, one pair per line. */
const ROWS = \``;

const body = accepted.map(([c, k]) => `${c} ${k}`).join('\n');

const footer = `\`;

const index = new Map<string, string[]>();
for (const line of ROWS.split('\\n')) {
  const gap = line.indexOf(' ');
  if (gap === -1) continue;
  const cyrillic = line.slice(0, gap);
  const classical = line.slice(gap + 1);
  const existing = index.get(cyrillic);
  if (existing === undefined) index.set(cyrillic, [classical]);
  else existing.push(classical);
}

/** Cyrillic citation form → every Classical reading this source records. */
export const toliIndex: ReadonlyMap<string, readonly string[]> = index;
`;

writeFileSync(OUT_PATH, `${header}\n${body}\n${footer}`);

console.log(JSON.stringify(stats, null, 2));
console.log(`\nwrote ${accepted.length} rows to ${OUT_PATH}`);
