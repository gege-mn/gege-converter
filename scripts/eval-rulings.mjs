#!/usr/bin/env node
/**
 * Score the pipeline against the bichig reader's verdicts in
 * `test/rulings.test.ts`.
 *
 * ## Why this is a separate metric
 *
 * A metric that averages over 1,768 forms cannot notice that the eight that
 * came from a human are all wrong.
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
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RULINGS = resolve(ROOT, 'test/rulings.test.ts');

if (!existsSync(resolve(ROOT, 'dist/index.js'))) {
  console.error('needs a build first: bun run build');
  process.exit(1);
}

const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { convert } = await load('dist/index.js');
const { toScript } = await load('dist/romanize.js');

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

/**
 * Graded in SCRIPT. γ/g and q/k are harmony-selected allographs of one letter,
 * so `ger` and `γer` are byte-identical output — comparing romanizations
 * invents disagreements, which is footgun 1 in CLAUDE.md.
 */
function score(entries, label) {
  let ok = 0;
  let scored = 0;
  let skipped = 0;

  for (const e of entries) {
    let want;
    try {
      want = toScript(e.classical);
    } catch {
      // A romanization our own generator refuses is a data problem in the test
      // file, not a converter failure — say so rather than counting it wrong.
      skipped += 1;
      continue;
    }
    scored += 1;
    if (convert(e.cyrillic) === want) ok += 1;
  }

  const pct = scored ? `${((ok / scored) * 100).toFixed(1)}%` : '—';
  console.log(`\n${label} — ${scored} scored`);
  console.log(`  pipeline  ${String(ok).padStart(3)}/${scored}  ${pct}`);
  if (skipped) console.log(`  skipped   ${skipped} (romanization our generator refuses)`);
}

score(confirmed, 'CONFIRMED by the reader');
score(todo, 'KNOWN WRONG (it.todo)');
