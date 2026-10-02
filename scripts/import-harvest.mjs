#!/usr/bin/env node
/**
 * Turn the silver set into lexicon rows, as the `harvested` provenance tier.
 *
 * Three filters, each removing a class of row that would otherwise look like a
 * stem but is not one:
 *
 * 1. **Must be a lemma.** the silver attaches some suffixes without a connector, so
 *    "no connector in the output" does NOT mean "this is a stem" — аавтай
 *    comes back as ᠠᠪᠤᠲᠠᠢ, one token, but it is аав + тай. Rows are therefore
 *    kept only if the Cyrillic word appears as a headword/lemma in UniMorph,
 *    MonWN or Wiktionary, all of which are lemma lists by construction.
 *
 * 2. **Must lint clean.** Anything gege-linter still complains about after
 *    repair is quarantined rather than imported.
 *
 * 3. **Must round-trip.** The Classical romanization has to convert back to
 *    the same code points, or we do not understand the form well enough to
 *    store it.
 *
 * Rows that already exist in the hand-curated lexicon are skipped, never
 * overwritten — `lexicon` outranks `harvested` by definition.
 *
 *   node scripts/import-harvest.mjs [out.ts]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] ?? 'src/data/harvested-lexicon.ts';
const QUARANTINE = '.tmp/harvest-quarantine.jsonl';
const GOLD = 'test/fixtures/harvested-inflected.json';

const { fromScript, toScript } = await import(
  pathToFileURL(resolve(ROOT, 'dist/romanize.js')).href
);
const { scriptOf } = await import(pathToFileURL(resolve(ROOT, 'scripts/lib/silver.mjs')).href);
const { lexicon } = await import(pathToFileURL(resolve(ROOT, 'dist/data/lexicon.js')).href);

async function loadLinter() {
  for (const spec of [
    process.env.GEGE_LINTER,
    '@gege-mn/gege-linter',
    resolve(ROOT, '../gege-linter/dist/index.js'),
  ].filter(Boolean)) {
    const href = /^[./]|^[A-Za-z]:\\/.test(spec) ? pathToFileURL(resolve(spec)).href : spec;
    try {
      const mod = await import(href);
      if (typeof mod.lint === 'function') return mod;
    } catch {
      // next
    }
  }
  console.error('could not load gege-linter');
  process.exit(1);
}
const { lint } = await loadLinter();

// ------------------------------------------------------------------- lemmas

const lemmas = new Set();

const addLemmas = (file, extract) => {
  if (!existsSync(file)) return 0;
  const before = lemmas.size;
  for (const value of extract(readFileSync(file, 'utf8'))) {
    const v = String(value).trim().toLowerCase();
    if (v && !v.includes(' ')) lemmas.add(v);
  }
  return lemmas.size - before;
};

const nUni = addLemmas('.tmp/unimorph-khk.tsv', function* (t) {
  for (const line of t.split('\n')) {
    const c = line.split('\t');
    if (c[0]) yield c[0];
  }
});
const nWn = addLemmas('.tmp/monwn.tsv', function* (t) {
  for (const line of t.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const c = line.split('\t');
    if (c[1]?.endsWith('lemma') && c[2]) yield c[2];
  }
});
const nKk = addLemmas('.tmp/kaikki-mn.jsonl', function* (t) {
  for (const line of t.split('\n')) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line).word ?? '';
    } catch {
      // skip
    }
  }
});

// -------------------------------------------------------------------- import

const curated = new Set(lexicon.map((e) => e.cyrillic));

const rows = [];
for (const line of readFileSync('.tmp/harvest-harvest.jsonl', 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try {
    rows.push(JSON.parse(line));
  } catch {
    // skip a torn line
  }
}

/**
 * Cyrillic endings that are inflectional, not part of a stem. Wiktionary lists
 * some inflected forms as headwords (аавтай is an entry), so the lemma filter
 * alone lets them through — and storing аавтай as a *stem* would make the
 * segmenter produce it twice, once whole and once as аав + тай.
 *
 * The test is deliberately conservative: an ending only counts as a suffix if
 * stripping it leaves a word that is ITSELF attested. A stem that merely
 * happens to end in these letters has no such shorter form, so it survives.
 */
const INFLECTIONAL = [
  'тай',
  'тэй',
  'той',
  'ууд',
  'үүд',
  'ийн',
  'ын',
  'ийг',
  'ыг',
  'аас',
  'ээс',
  'оос',
  'өөс',
  'аар',
  'ээр',
  'оор',
  'өөр',
  'даа',
  'дээ',
  'над',
  'нүүд',
];

const looksInflected = (word, attested) =>
  INFLECTIONAL.some((sfx) => {
    if (!word.endsWith(sfx) || word.length <= sfx.length + 1) return false;
    return attested.has(word.slice(0, -sfx.length));
  });

/**
 * Whether a Classical form carries a real suffix chain — the far more reliable
 * inflection test, because it reads the silver answer instead of guessing
 * from the Cyrillic. The silver wrote `abu-du` with a connector; that IS the
 * statement "this is a stem plus a suffix".
 *
 * The one shape that must not be mistaken for a suffix is chachlag: `qar-a` is
 * a stem, not qar + a. A trailing single-vowel piece is chachlag when it is
 * a/e and a genuine suffix otherwise — the genitive after н is `-u`/`-ü`
 * (qaγan-u), and no suffix in the table is bare `a` or `e`.
 */
const hasSuffixChain = (classical) => {
  const parts = classical.split('-');
  if (parts.length < 2) return false;
  if (parts.length === 2 && /^[ae]$/.test(parts[1])) return false;
  return true;
};

const stats = {
  total: rows.length,
  multiword: 0,
  notLemma: 0,
  alreadyCurated: 0,
  inflected: 0,
  dirty: 0,
  roundTripFailed: 0,
  imported: 0,
  gold: 0,
};
const accepted = [];
const gold = [];
const quarantined = [];

for (const r of rows) {
  if (r.cyrillic.includes(' ')) {
    stats.multiword += 1;
    continue;
  }
  if (curated.has(r.cyrillic)) {
    stats.alreadyCurated += 1;
    continue;
  }
  if (!lemmas.has(r.cyrillic)) {
    stats.notLemma += 1;
    continue;
  }
  // An inflected form is not a stem, however it was written — but it is not
  // waste either. It is the silver answer for the whole segment-and-generate
  // pipeline, so it is romanized like any other row and routed to the fixture.
  const attachedInflection = looksInflected(r.cyrillic, lemmas);

  // No ГА repair. The harvest writes асгах `asqaqu` and сэтгэл `sedkil` with
  // ХА, that looked like an unruled devoicing habit, and on 2026-07-29 a
  // reader answered ГА to six words, which shipped as `repairDevoicedGa` over
  // 224 rows. The 2026 rulebook says the harvest was right — rule 2.1.2.3,
  // with тосгон and сэтгэл as two of its own four examples:
  //
  //   ᠳ (-д), ᠰ (-с) дэвсгэрийн дараа дуутай ᠭ (-г) гийгүүлэгч орохгүй, харин
  //   дуугүй шинжээр зохицон ᠬ (-х) гийгүүлэгч орно.
  //
  // Withdrawn 2026-07-31. See docs/rulings.md for why the reader's six answers
  // do not outvote it: the rule is silent on the two they agreed with (салгах
  // is л, агаар is a vowel) and contradicts all three it covers.
  const script = scriptOf(r);

  const diagnostics = lint(script).filter((d) => d.severity !== 'info');
  if (diagnostics.length > 0) {
    stats.dirty += 1;
    quarantined.push({ ...r, script, reason: diagnostics.map((d) => d.rule).join(',') });
    continue;
  }

  let classical;
  try {
    classical = fromScript(script);
    // The romanization must regenerate the exact same code points, or our
    // understanding of the form is incomplete and storing it would be a lie.
    if (toScript(classical) !== script) {
      stats.roundTripFailed += 1;
      quarantined.push({ ...r, script, reason: 'round-trip mismatch' });
      continue;
    }
  } catch (e) {
    stats.roundTripFailed += 1;
    quarantined.push({ ...r, script, reason: `romanize: ${e.message}` });
    continue;
  }

  if (attachedInflection || hasSuffixChain(classical)) {
    gold.push({
      cyrillic: r.cyrillic,
      classical,
      // Whether the silver wrote the suffix detached (so the chain is readable) or
      // attached — the two are graded the same but fail differently.
      detached: hasSuffixChain(classical),
    });
    stats.inflected += 1;
    continue;
  }

  accepted.push({ cyrillic: r.cyrillic, classical, harmony: r.harmony });
  stats.imported += 1;
}

accepted.sort((a, b) => a.cyrillic.localeCompare(b.cyrillic, 'mn'));
gold.sort((a, b) => a.cyrillic.localeCompare(b.cyrillic, 'mn'));
stats.gold = gold.length;

const header = `/**
 * Bulk Cyrillic → Classical pairs — silver —
 * encoding-repaired by gege-linter and orthographically normalised by
 * \`src/orthography.ts\`. GENERATED — do not edit by hand.
 *
 *   node scripts/import-harvest.mjs
 *
 * This is the \`harvested\` provenance tier: large and useful, but UNREVIEWED. The
 * silver is real converter output and agrees with a bichig reader on most spot checks, but
 * it differs from this project on documented points (it writes ᠮᠣᠩᠭᠣᠯ, and the
 * older V+y+i diphthong), which is why every row here has been through
 * \`normalizeOrthography\` first. A word already present in the hand-curated
 * lexicon is never imported — \`lexicon\` outranks \`harvested\` for the same key.
 *
 * Only rows passing all three filters are here: the Cyrillic word is a lemma
 * in UniMorph/MonWN/Wiktionary, the script lints clean above info severity,
 * and the romanization regenerates the identical code points.
 *
 * ${accepted.length} entries, generated from ${stats.total} harvested rows.
 */

import type { LexiconEntry } from '../types.js';

export const harvestedLexicon: readonly LexiconEntry[] = [
`;

const body = accepted
  .map(
    (e) =>
      `  { cyrillic: ${JSON.stringify(e.cyrillic)}, classical: ${JSON.stringify(e.classical)}, freq: 0.5 },`,
  )
  .join('\n');

writeFileSync(OUT, `${header}${body}\n];\n`);
writeFileSync(QUARANTINE, `${quarantined.map((q) => JSON.stringify(q)).join('\n')}\n`);
writeFileSync(
  GOLD,
  `${JSON.stringify(
    {
      _comment: [
        'the silver answers for INFLECTED forms. GENERATED by',
        'scripts/import-harvest.mjs — do not edit by hand.',
        'These are deliberately NOT in the lexicon: storing an inflected form as',
        'a stem inflates coverage and hides the fact that the pipeline could not',
        'have derived it. Held out here, they measure segment + resolve + generate',
        'end to end. `detached` means the silver wrote the suffix after a connector, so',
        'the chain is readable; when false it wrote it attached.',
      ].join(' '),
      entries: gold,
    },
    null,
    2,
  )}\n`,
);

const pct = (n) => `${((100 * n) / stats.total).toFixed(1)}%`;
console.log(`lemma set: ${nUni} UniMorph + ${nWn} MonWN + ${nKk} Wiktionary = ${lemmas.size}\n`);
console.log(`harvested rows        ${String(stats.total).padStart(6)}`);
console.log(
  `  multiword           ${String(stats.multiword).padStart(6)}  ${pct(stats.multiword)}`,
);
console.log(`  not a lemma         ${String(stats.notLemma).padStart(6)}  ${pct(stats.notLemma)}`);
console.log(
  `  already curated     ${String(stats.alreadyCurated).padStart(6)}  ${pct(stats.alreadyCurated)}`,
);
console.log(
  `  inflected → gold    ${String(stats.inflected).padStart(6)}  ${pct(stats.inflected)}`,
);
console.log(`  lint-dirty          ${String(stats.dirty).padStart(6)}  ${pct(stats.dirty)}`);
console.log(
  `  round-trip failed   ${String(stats.roundTripFailed).padStart(6)}  ${pct(stats.roundTripFailed)}`,
);
console.log(`  IMPORTED            ${String(stats.imported).padStart(6)}  ${pct(stats.imported)}`);
console.log(`\nwrote ${OUT}`);
console.log(`gold set    ${gold.length} inflected forms → ${GOLD}`);
console.log(`quarantined ${quarantined.length} rows → ${QUARANTINE}`);
