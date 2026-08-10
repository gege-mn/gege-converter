#!/usr/bin/env node
/**
 * Re-derive the verb suffix table from attested pairs.
 *
 *   pnpm build && node scripts/mine-verb-suffixes.mjs
 *       [--corpus f.jsonl] [--min 3] [--all] [--include-held-out]
 *
 * `src/data/verb-suffixes.ts` is the only data file in this package whose
 * Classical column has no upstream authority: the canonical registry in
 * `@gege-mn/mongol-bichig` is entirely nominal, and its one verb-adjacent row
 * is flagged low-confidence. Writing the forms from memory is exactly what this
 * project's rules forbid, so they are measured instead — and this script is how
 * that measurement is reproduced when the corpus or the lexicon changes.
 *
 * ## Method
 *
 * A Mongolian verb's citation form is its stem plus `-х`/`-qu`, so every `-х`
 * infinitive in the dictionary hands over a verb stem in BOTH alphabets:
 * нэрлэх / `nereleqü` gives нэрлэ- / `nerele-`. For each attested pair whose
 * Cyrillic begins with a known stem and whose script begins with the matching
 * Classical stem, the two remainders are the same suffix written twice.
 * Aggregate and the paradigm falls out, with counts.
 *
 * Stems are matched in **script**, never in romanization: γ/g and q/k are
 * harmony-selected allographs of one letter, so a romanized prefix test invents
 * mismatches that do not exist.
 *
 * ## Reading the output
 *
 * `share` is what fraction of an ending's occurrences took the dominant
 * Classical form. A low share means the ending is genuinely ambiguous, not that
 * the mining is unsure — `-лаа` comes out as `l-iyan`, the deverbal noun plus
 * the reflexive, because авралаа really is "one's rescue" and not a past tense.
 * Endings with few attestations are printed but should not be promoted into the
 * table; a row without evidence is a guess wearing a count.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { lexicon } = await load('dist/data/lexicon.js');
const { harvestedLexicon } = await load('dist/data/harvested-lexicon.js');
const { fromScript, toScript } = await load('dist/romanize.js');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const MIN = Number(arg('--min', 3));
const ALL = process.argv.includes('--all');
const INCLUDE_HELD_OUT = process.argv.includes('--include-held-out');

/**
 * The held-out verb gold set, skipped unless asked for.
 *
 * `test/fixtures/verb-gold.json` is carved **out of** `.tmp/aligned-words.jsonl`
 * — all 197 of its forms are still in that file — so pointing `--corpus` at the
 * aligned pool mines the eval set and then the eval set scores the rows. That
 * is not hypothetical: it is how the 2026-07-29 perfective rows were derived,
 * and `scripts/export-training-data.mjs` already holds these same forms out for
 * exactly this reason. This is that guard, on the other consumer.
 *
 * `--include-held-out` reproduces the counts mined before this existed. Shares
 * barely move either way — the perfective still comes out `γad`/`γed` dominant
 * with `uγad`/`üγed` as the consonant-final variant — which is the argument
 * that the rows are sound, not an argument that the measurement was.
 */
const heldOut = new Set();
if (!INCLUDE_HELD_OUT) {
  const goldPath = resolve(ROOT, 'test/fixtures/verb-gold.json');
  if (existsSync(goldPath)) {
    for (const e of JSON.parse(readFileSync(goldPath, 'utf8')).entries) {
      heldOut.add(e.cyrillic.toLowerCase());
    }
  }
}

const INFINITIVE = /(qu|qü|ku|kü)$/;
const stems = new Map();
for (const r of [...lexicon, ...harvestedLexicon]) {
  if (!r.cyrillic.endsWith('х') || !INFINITIVE.test(r.classical)) continue;
  const cy = r.cyrillic.slice(0, -1);
  const cl = r.classical.replace(INFINITIVE, '');
  if (cy.length >= 2 && cl.length >= 2) stems.set(cy, cl);
}

/** Longest known stem that prefixes `w`; longest so ажилла- beats ажил-. */
const longestStem = (w) => {
  for (let i = w.length - 1; i >= 2; i--) {
    const cl = stems.get(w.slice(0, i));
    if (cl !== undefined) return { cy: w.slice(0, i), cl };
  }
  return undefined;
};

/**
 * Which attested pairs to mine. The default is the word harvest, which is a
 * *lemma* dictionary and therefore structurally blind to endings that never
 * appear as a headword — the perfective converb, `-ж`, `-на/-нэ`. Point this at
 * `.tmp/aligned-words.jsonl` (from `scripts/align-sentences.mjs`) to mine
 * running text instead, where those endings are the frequent ones.
 */
const corpus = resolve(ROOT, arg('--corpus', '.tmp/harvest-harvest.jsonl'));
if (!existsSync(corpus)) {
  console.log(`needs ${corpus} — not present, nothing to mine`);
  process.exit(0);
}

const pairs = new Map();
let rows = 0;
let matched = 0;
let skipped = 0;

for (const line of readFileSync(corpus, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let r;
  try {
    r = JSON.parse(line);
  } catch {
    continue;
  }
  const cy = (r.cyrillic ?? '').toLowerCase();
  // `unicode` is the harvest's field name, `script` the aligned pool's.
  const script = r.unicode ?? r.script ?? '';
  if (!cy || !script) continue;
  if (heldOut.has(cy)) {
    skipped += 1;
    continue;
  }
  rows += 1;

  const s = longestStem(cy);
  if (s === undefined || s.cy === cy) continue;

  let stemScript;
  try {
    stemScript = toScript(s.cl);
  } catch {
    continue;
  }
  if (!script.startsWith(stemScript)) continue;

  let clSuffix;
  try {
    clSuffix = fromScript(script.slice(stemScript.length));
  } catch {
    continue;
  }
  const cySuffix = cy.slice(s.cy.length);
  if (!cySuffix || !clSuffix) continue;
  matched += 1;

  const byCl = pairs.get(cySuffix) ?? new Map();
  const cell = byCl.get(clSuffix) ?? { n: 0, ex: [] };
  cell.n += 1;
  if (cell.ex.length < 3) cell.ex.push(`${cy} = ${s.cy}+${cySuffix} → ${s.cl}+${clSuffix}`);
  byCl.set(clSuffix, cell);
  pairs.set(cySuffix, byCl);
}

console.log(`verb stems ${stems.size}   corpus rows ${rows}   stem-matched ${matched}`);
console.log(
  skipped > 0
    ? `${skipped} rows skipped: held out in test/fixtures/verb-gold.json.` +
        ' Pass --include-held-out to reproduce counts mined before 2026-07-29.\n'
    : '',
);

const ranked = [...pairs]
  .map(([cySuffix, byCl]) => {
    const total = [...byCl.values()].reduce((a, c) => a + c.n, 0);
    const sorted = [...byCl].sort((a, b) => b[1].n - a[1].n);
    return { cySuffix, total, sorted, share: sorted[0][1].n / total };
  })
  .filter((r) => r.total >= MIN)
  .sort((a, b) => b.total - a.total);

const shown = ALL ? ranked : ranked.slice(0, 40);
console.log(
  `${'cyrillic'.padEnd(10)} ${'n'.padStart(5)}  ${'classical'.padEnd(14)} share  runners-up`,
);
for (const { cySuffix, total, sorted, share } of shown) {
  const others = sorted
    .slice(1, 3)
    .map(([k, v]) => `${k}(${v.n})`)
    .join(' ');
  console.log(
    `${cySuffix.padEnd(10)} ${String(total).padStart(5)}  ${sorted[0][0].padEnd(14)} ${(100 * share).toFixed(0).padStart(4)}%  ${others}`,
  );
}
console.log(
  `\n${ranked.length} endings at >=${MIN} attestations. Most are DERIVATIONAL (-лт → lta,`,
);
console.log('-гч → γči) and belong in the lexicon as their own lemmas, not in a suffix table.');
console.log('Promote an ending only when the count and the share both hold up.');
