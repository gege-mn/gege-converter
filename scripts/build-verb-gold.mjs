#!/usr/bin/env node
/**
 * Carve a held-out VERB gold set out of the sentence-aligned word pairs.
 *
 * ## Why this has to exist
 *
 * `test/fixtures/harvested-inflected.json` — the gold set every accuracy figure
 * in this project is quoted against — contains **2 verb-shaped forms out of
 * 1,768**. Its top endings are `-тай` (198), `-ийн` (135), `-аар` (128): case,
 * comitative, plural. That is not an accident, it is construction.
 * `import-harvest.mjs` routes a form to gold when it matches the `INFLECTIONAL`
 * list, and every entry on that list is nominal.
 *
 * So the metric is structurally blind to verbs, which are 24.8% of running-text
 * tokens and 48.5% of guesser output. On 2026-07-27 a training run added 1,966
 * sentence-aligned pairs, moved gold 54.8% → 59.2%, and **none of that movement
 * was verbs** — the verb gains were visible only by hand-inspecting two words.
 * Measuring a thing you cannot score is how a project convinces itself it is
 * making progress.
 *
 * ## Why stratified rather than random
 *
 * A model can be good at `-сан` and hopeless at `-аад` and land on a
 * respectable average. Each ending is a separate morphological rule and gets
 * its own bucket, so the eval reports where the failure is rather than that
 * there is one. The small groups are deliberately kept — `-вал/-вэл` at n=4 is
 * not a statistic, but a zero there is still a signal worth seeing.
 *
 * ## What this set is NOT
 *
 * These are the **silver data's** answers, anchor-verified at 95.3%.
 * A bichig reader then sampled them twice on 2026-07-27 — 28 forms drawn from
 * the aligned pool before it was trained on, and 28 more drawn from this set
 * once it was carved out — and ruled **56/56 correct**, covering every group
 * including all four `-лаа` forms and the `-вал` conditional.
 *
 * That makes them good enough to steer on. It does **not** make them
 * `test/rulings.test.ts`, which is a reader's direct verdicts on forms *this
 * converter produced* and outranks this set on any disagreement. 56 of 658 is a
 * sample, not an audit: it bounds the systematic error rate, not the individual
 * one. Never quote this set as reader-verified.
 *
 * One known soft spot: `-лаа/-лээ` is genuinely ambiguous between a verbal past
 * (`l-a`/`l-e`, 68% in running text) and a deverbal noun plus reflexive
 * (`l-iyan`), and the two are not distinguishable from the Cyrillic. Those rows
 * are marked `ambiguous` so a miss there can be discounted.
 *
 * ## The cost, stated plainly
 *
 * There are only 658 verb forms in total. Holding out ~30% removes them from
 * training, which is a real loss of the scarcest signal in the corpus. It is
 * still the right trade: an unmeasurable improvement cannot be defended, and
 * 72.6% of the parallel sentences remain unmined if more verbs are needed.
 *
 *   node scripts/build-verb-gold.mjs [out.json] [--in f.jsonl] [--fraction 0.3]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const FLAGS_TAKING_A_VALUE = new Set(['--in', '--fraction']);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const positional = args.find(
  (a, i) => !a.startsWith('--') && !FLAGS_TAKING_A_VALUE.has(args[i - 1] ?? ''),
);
const OUT = positional ?? 'test/fixtures/verb-gold.json';
const IN = flag('--in', '.tmp/aligned-words.jsonl');
const FRACTION = Number(flag('--fraction', 0.3));

if (!existsSync(IN)) {
  console.error(`missing ${IN} — run scripts/align-sentences.mjs first`);
  process.exit(1);
}

const { fromScript, toScript } = await import(
  pathToFileURL(resolve(ROOT, 'dist/romanize.js')).href
);

const pairs = [];
for (const line of readFileSync(IN, 'utf8').split('\n')) {
  if (!line.replace(/[ \n\r\t]/g, '')) continue;
  try {
    pairs.push(JSON.parse(line));
  } catch {
    // torn line
  }
}

/**
 * Ordered longest-ending-first so a form is claimed by its most specific group:
 * `-вал` must win over the `-л`-adjacent groups, and a word is only ever in one
 * bucket so the per-group counts sum to the total.
 */
const GROUPS = [
  ['converb-imperfective', /[жч]$/],
  ['converb-perfective', /(аад|ээд|оод|өөд)$/],
  ['participle-past', /(сан|сэн|сон|сөн)$/],
  ['participle-habitual', /(даг|дэг|дог|дөг)$/],
  ['present-future', /(на|нэ|но|нө)$/],
  ['converb-conditional', /(вал|вэл)$/],
  ['converb-terminative', /(тал|тэл)$/],
  ['past-or-nominal', /(лаа|лээ|лоо|лөө)$/],
];

/** The one group where a miss may not be an error — see the header. */
const AMBIGUOUS = new Set(['past-or-nominal']);

/** Deterministic PRNG (mulberry32) — the split must be reproducible. */
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const random = rng(20260727);
const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const claimed = new Set();
const entries = [];
const report = [];

for (const [group, re] of GROUPS) {
  const pool = pairs.filter((p) => re.test(p.cyrillic) && !claimed.has(p.cyrillic));
  for (const p of pool) claimed.add(p.cyrillic);

  // At least one from every group: a group that never appears in the test set
  // cannot fail visibly, which defeats the point of stratifying.
  const take = Math.max(1, Math.round(pool.length * FRACTION));
  const picked = shuffle(pool).slice(0, take);

  for (const p of picked) {
    // Romanization is a convenience for readers and for the pipeline eval,
    // which stores gold as Classical. `script` is authoritative: it is what the
    // model emits and what grading compares, per "grade in SCRIPT, never in
    // romanization". A form that does not round-trip still belongs in the set.
    let classical = null;
    try {
      const r = fromScript(p.script);
      if (toScript(r) === p.script) classical = r;
    } catch {
      classical = null;
    }
    entries.push({
      cyrillic: p.cyrillic,
      script: p.script,
      ...(classical ? { classical } : {}),
      group,
      ...(AMBIGUOUS.has(group) ? { ambiguous: true } : {}),
    });
  }
  report.push([group, pool.length, picked.length]);
}

entries.sort((a, b) => a.cyrillic.localeCompare(b.cyrillic, 'mn'));

/**
 * Escape the invisible characters as `\uXXXX`, per CLAUDE.md: they must never
 * appear as literals in `src` or `test`, and `grep -rlP '[\x{180E}\x{202F}]'`
 * over those trees must return nothing.
 *
 * `harvested-inflected.json` sidesteps this by storing only romanization, but
 * this set stores `script` deliberately — romanization is not total, and two of
 * these forms do not round-trip through it. So the invisibles are escaped
 * instead. Visible bichig letters stay literal, which the rule allows and which
 * keeps the file diffable by eye.
 *
 * JSON.parse decodes these, so consumers see the real characters and nothing
 * downstream needs to know.
 */
// Written as an alternation rather than one character class: ZWJ and ZWNJ
// inside a class trip biome's noMisleadingCharacterClass, which exists
// because a class cannot match a joined sequence. Every branch here is a
// single code point, so the replace callback still sees one character.
const INVISIBLE = /[\u180B-\u180F]|\u200C|\u200D|\u202F/g;
const escapeInvisible = (json) =>
  json.replace(INVISIBLE, (c) => `\\u${c.codePointAt(0).toString(16).padStart(4, '0')}`);

writeFileSync(
  resolve(ROOT, OUT),
  `${escapeInvisible(
    JSON.stringify(
      {
        _comment: [
          'Held-out VERB gold set. GENERATED by scripts/build-verb-gold.mjs — do not edit by hand.',
          'Exists because test/fixtures/harvested-inflected.json contains 2 verb-shaped forms out of',
          '1,768 and therefore cannot measure verb accuracy at all.',
          'Source: word pairs aligned out of the parallel sentences, anchor-verified at 95.3%',
          'leave-one-out. A bichig reader sampled these twice on 2026-07-27 — 28 forms from the',
          'aligned pool and 28 from this set — and ruled 56/56 correct across every group.',
          'They remain the silver’s answers, NOT a reader’s verdicts:',
          'test/rulings.test.ts outranks this set wherever the two disagree, and 56 of 658 bounds',
          'the systematic error rate rather than the individual one.',
          '`script` is authoritative and is what grading compares; `classical` is a convenience and',
          'is absent where the form does not round-trip. `ambiguous` marks the -лаа group, where the',
          'verbal and deverbal-noun readings are both valid and indistinguishable from the Cyrillic.',
          'MUST be held out of training: scripts/export-training-data.mjs removes these keys.',
        ].join(' '),
        generatedBy: 'scripts/build-verb-gold.mjs',
        seed: 20260727,
        fraction: FRACTION,
        entries,
      },
      null,
      2,
    ),
  )}\n`,
);

console.log(`${'group'.padEnd(22)} ${'pool'.padStart(5)} ${'held out'.padStart(9)}`);
for (const [g, pool, took] of report) {
  console.log(`${g.padEnd(22)} ${String(pool).padStart(5)} ${String(took).padStart(9)}`);
}
console.log('-'.repeat(38));
console.log(
  `${'TOTAL'.padEnd(22)} ${String(report.reduce((n, r) => n + r[1], 0)).padStart(5)} ${String(entries.length).padStart(9)}`,
);
console.log(`\n→ ${OUT}`);
console.log(`with classical: ${entries.filter((e) => e.classical).length} of ${entries.length}`);
