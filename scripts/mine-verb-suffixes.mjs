#!/usr/bin/env node
/**
 * Re-derive the verb suffix table from attested pairs.
 *
 *   pnpm build && node scripts/mine-verb-suffixes.mjs
 *       [--corpus f.jsonl] [--min 3] [--all] [--include-held-out]
 *       [--split] [--ending жээ,чээ] [--hosts] [--prefix-only] [--no-corpus-stems]
 *   node scripts/mine-verb-suffixes.mjs --recovery
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
 * ## What changed on 2026-10-02, and why the old counts were so small
 *
 * Four things, each of which the table's own comments had been working around
 * by hand:
 *
 * 1. **The stem is recovered the way `parseVerb` recovers it.** A prefix match
 *    only sees forms that spell the stem's final vowel out (ажилла + сан), and
 *    Cyrillic drops that vowel before most consonant-initial endings (ав + сан,
 *    хэл + нэ). That is why `-сан` was mined at n=17 from 31,320 rows: nearly
 *    every past participle in the corpus was invisible. The head is now also
 *    tried with its soft sign undone (ярь → яри), its final vowel put back
 *    (хэл → хэлэ) and its metathesis reversed (учир → учра), and — exactly as
 *    at runtime — a recovered stem counts only if it is an attested infinitive.
 *    `--prefix-only` restores the old matching.
 * 2. **An ending is split by harmony and by the stem's дэвсгэр** (`--split`).
 *    The `-ж` rows were split that way by hand and so "do not come back out of
 *    the script"; now they do. The classes are the rulebook's: vowel-final,
 *    хатуу дэвсгэр (б г р с д), зөөлөн дэвсгэр (everything else).
 * 3. **`normalizeOrthography` is applied to the corpus.** The silver set's
 *    `unicode` field is only encoding-repaired, and this script was reading it
 *    raw — the mistake `.claude/rules/data-rows.md` records as having trained a
 *    model on the wrong convention.
 * 4. **Loanwords are excluded before counting**, and so is the held-out sample
 *    of `test/fixtures/attested-heldout.json`, by the importer's own hash.
 *
 * The corpus's own infinitives are also read as stems (`--no-corpus-stems`
 * turns that off): the silver word list is running text now, so it carries өгөх
 * beside өгсөн, and a stem and its inflection written by the same source agree
 * on the stem's spelling by construction.
 *
 * ## Reading the output
 *
 * `share` is what fraction of an ending's occurrences took the dominant
 * Classical form. A low share means the ending is genuinely ambiguous, not that
 * the mining is unsure — `-лаа` comes out as `l-iyan`, the deverbal noun plus
 * the reflexive, because авралаа really is "one's rescue" and not a past tense.
 * Endings with few attestations are printed but should not be promoted into the
 * table; a row without evidence is a guess wearing a count.
 *
 * With `--split`, each ending is followed by one line per harmony × дэвсгэр
 * cell. A row in the table that carries `harmony` or `after` quotes a cell, not
 * the ending's total, and its `share` is the share **within that cell** —
 * which is what the ranker multiplies by, so a cell share is the honest one.
 *
 * `--ending` narrows the output to the endings named, splits them, and prints
 * examples of every reading. Adding `--hosts` splits them a third way, by the
 * **Cyrillic letter the ending follows** — the only place the difference
 * between the converb гарч and the agent noun эмч shows. That view also counts
 * the words whose stem was found but whose script does not begin with it
 * (`≠stem`): a noun that merely looks like stem + ending lands there, and an
 * ending is only as safe as that column is empty.
 *
 * ## `--recovery`: how often each way of finding a stem is right
 *
 * A different question from the rest, so a different mode. `verb-stem.ts` finds
 * a stem the word does not spell out in three ways — appending a vowel,
 * exchanging the last two letters, putting back an absorbed и — and each is a
 * proposal filtered by "is it an attested infinitive". This audits that
 * filter: for every corpus word ending in one of the **table's own** endings
 * whose head is no stem as written, was the silver's script built on the
 * stem each route proposes? It reads the stems `parseVerb` reads (all three
 * dictionary tiers), and it applies none of `parseVerb`'s surface guards, so
 * it is the routes alone that are being counted. The numbers quoted in
 * `restoreMetathesis` come from here.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { lexicon } = await load('dist/data/lexicon.js');
const { harvestedLexicon } = await load('dist/data/harvested-lexicon.js');
const { fromScript, toScript } = await load('dist/romanize.js');
const { normalizerFor } = await load('scripts/lib/silver.mjs');
const { harmonyOf } = await load('dist/chars.js');
const { allomorphFits, endsInVowel } = await load('dist/allomorph.js');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const MIN = Number(arg('--min', 3));
const ALL = process.argv.includes('--all');
const INCLUDE_HELD_OUT = process.argv.includes('--include-held-out');
const PREFIX_ONLY = process.argv.includes('--prefix-only');
const CORPUS_STEMS = !process.argv.includes('--no-corpus-stems');
const ENDINGS = (arg('--ending', '') ?? '').split(',').filter(Boolean);
const SPLIT = process.argv.includes('--split') || ENDINGS.length > 0;
const HOSTS = process.argv.includes('--hosts');

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
 *
 * Since 2026-10-02 the same flag also covers the **attested held-out sample**:
 * the words `scripts/import-attested.mjs` withholds from the `attested` tier so
 * that something still measures a word the pipeline has never seen. A suffix
 * row mined from them would be the table memorising that measurement. They are
 * recognised by the importer's own hash rather than by reading its fixture, so
 * a word added after the fixture was last written is withheld all the same.
 */
const heldOut = new Set();
if (!INCLUDE_HELD_OUT) {
  for (const file of ['test/fixtures/verb-gold.json', 'test/fixtures/attested-heldout.json']) {
    const path = resolve(ROOT, file);
    if (!existsSync(path)) continue;
    for (const e of JSON.parse(readFileSync(path, 'utf8')).entries) {
      heldOut.add(e.cyrillic.toLowerCase());
    }
  }
}
/** `inSample` of `scripts/import-attested.mjs`, without its frequency floor. */
const inHeldOutSample = (word) =>
  !INCLUDE_HELD_OUT &&
  createHash('sha1').update(`holdout:${word}`).digest().readUInt32BE(0) % 100 < 3;

/**
 * Loanwords, which are exempt from every rule and must not help derive one.
 *
 * Two tells, either sufficient. The Cyrillic one is the letters native words do
 * not use (к, ф, щ) and the initials native words do not start with (п, в, р,
 * л). The script one is the silver's own judgement: it spells a foreign word
 * with the Ali Gali letters (U+1827 EE, U+1839–1842) or a variation selector,
 * and a native word with neither. Over-excluding costs a few attestations;
 * under-excluding finds the transliteration convention and calls it Mongolian.
 */
const FOREIGN_LETTERS = /[\u1827\u1839-\u1842]/;
const SELECTORS = /[\u180B-\u180D\u180F]/;
const isLoanword = (cyrillic, script) =>
  /[кфщ]/.test(cyrillic) ||
  /^[пврл]/.test(cyrillic) ||
  FOREIGN_LETTERS.test(script) ||
  SELECTORS.test(script);

/**
 * Which attested pairs to mine. The default is the silver word list. Until
 * 2026-10-02 that was a *lemma* dictionary, structurally blind to endings that
 * never appear as a headword; it is now the commonest words of running text,
 * so the inflections are the frequent rows. `.tmp/aligned-words.jsonl` (from
 * `scripts/align-sentences.mjs`) is the reader-sampled alternative.
 */
const corpus = resolve(ROOT, arg('--corpus', '.tmp/harvest-harvest.jsonl'));
if (!existsSync(corpus)) {
  console.log(`needs ${corpus} — not present, nothing to mine`);
  process.exit(0);
}

const rowsIn = [];
let skipped = 0;
let loanwords = 0;
for (const line of readFileSync(corpus, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let r;
  try {
    r = JSON.parse(line);
  } catch {
    continue;
  }
  const cy = (r.cyrillic ?? '').toLowerCase();
  // `unicode` is the silver set's field name, `script` the aligned pool's. Both
  // are encoding-repaired only; the orthography pass is ours to apply.
  const raw = r.unicode ?? r.script ?? '';
  if (!cy || !raw) continue;
  if (heldOut.has(cy) || inHeldOutSample(cy)) {
    skipped += 1;
    continue;
  }
  // The row says how it was repaired, and that picks the normaliser — a row
  // from `tungaamalToUnicode` must not go through `dropGlideYa` again. See
  // `lib/silver.mjs`.
  const script = normalizerFor(r)(raw);
  if (isLoanword(cy, script)) {
    loanwords += 1;
    continue;
  }
  rowsIn.push({ cy, script });
}

const INFINITIVE = /(qu|qü|ku|kü)$/;
const stems = new Map();
const addStem = (cyrillic, classical) => {
  if (!cyrillic.endsWith('х') || !INFINITIVE.test(classical)) return;
  const cy = cyrillic.slice(0, -1);
  const cl = classical.replace(INFINITIVE, '');
  if (cy.length >= 2 && cl.length >= 2) stems.set(cy, cl);
};
// Weakest first, so the dictionary's reading of a stem wins over the corpus's
// where both list the infinitive — the order `parseVerb` reads them in.
if (CORPUS_STEMS) {
  for (const { cy, script } of rowsIn) {
    if (!cy.endsWith('х') || script.includes(' ')) continue;
    try {
      addStem(cy, fromScript(script));
    } catch {
      // an infinitive the romanizer cannot read hands over no stem
    }
  }
}
for (const r of harvestedLexicon) addStem(r.cyrillic, r.classical);
for (const r of lexicon) addStem(r.cyrillic, r.classical);

const VOWELS = new Set([...'аэиоөуүяеёюы']);
const STEM_VOWELS = [...'эаоөиуү'];
/** The vowels Cyrillic inserts when a stem's final vowel drops out of a cluster. */
const EPENTHETIC = new Set([...'аэоөи']);

/**
 * Stems a peeled head could stand for, strongest reading first — the moves
 * `parseVerb` makes, in the same order, and under the same rule that a
 * recovered stem must be an attested infinitive.
 *
 * Deliberately looser than `parseVerb` in one way: the exchange is proposed
 * across any consonant and even when a vowel also appends. That is safe here
 * and would not be there, because here the silver's script arbitrates — a
 * proposal counts only if the word was actually written on that stem — and it
 * is what lets `--recovery` measure the letters `parseVerb` leaves out.
 */
function stemsOf(head) {
  const out = [];
  const push = (cy, how) => {
    const cl = stems.get(cy);
    if (cl !== undefined) out.push({ cy, cl, how });
  };
  push(head, 'exact');
  if (PREFIX_ONLY) return out;
  if (head.endsWith('ь')) push(`${head.slice(0, -1)}и`, 'soft-sign');
  const last = head[head.length - 1];
  if (last === undefined || VOWELS.has(last)) return out;
  for (const v of STEM_VOWELS) push(`${head}${v}`, 'restored');
  const inserted = head[head.length - 2];
  if (inserted !== undefined && EPENTHETIC.has(inserted)) {
    for (const v of STEM_VOWELS) push(`${head.slice(0, -2)}${last}${v}`, 'metathesis');
  }
  return out;
}

/** The rulebook's three stem classes, read off the Classical stem. */
const classOf = (cl) => (endsInVowel(cl) ? 'vowel' : allomorphFits('hard', cl) ? 'hard' : 'soft');

/**
 * Longest head that resolves to a stem whose script begins the word's.
 *
 * `unconfirmed` is set, and nothing else, when a stem was found but the
 * silver did not write the word on it — a different word that happens to
 * share the letters, or the same verb on a differently spelled stem.
 */
function analyse(cy, script) {
  for (let i = cy.length - 1; i >= 2; i--) {
    const found = stemsOf(cy.slice(0, i));
    if (found.length === 0) continue;
    for (const s of found) {
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
      if (!clSuffix) continue;
      return { ...s, cySuffix: cy.slice(i), clSuffix };
    }
    // The longest stem is the verb; a shorter prefix is a different one.
    return { unconfirmed: true, cySuffix: cy.slice(i), host: cy[i - 1] };
  }
  return undefined;
}

if (process.argv.includes('--recovery')) {
  const { verbStems } = await load('dist/verb-stem.js');
  const { verbSuffixes } = await load('dist/data/verb-suffixes.js');
  // What `stemOf` would return: curated and harvested first, then the
  // corpus's own infinitive, then the dictionary tier.
  const runtime = new Map(stems);
  for (const [cy, stem] of verbStems) if (!runtime.has(cy)) runtime.set(cy, stem.classical);
  const endings = [...new Set(verbSuffixes.map((r) => r.cyrillic))].sort(
    (a, b) => b.length - a.length,
  );
  const begins = (script, cy) => {
    try {
      return script.startsWith(toScript(runtime.get(cy)));
    } catch {
      return false;
    }
  };
  const known = (list) => list.filter((cy) => runtime.has(cy));
  const tally = () => ({ n: 0, right: 0, wrong: [] });
  const exchanged = { only: tally(), across: new Map(), long: tally() };
  const both = { n: 0, appended: 0, exchanged: 0 };
  const absorbed = tally();
  const count = (t, ok, cy) => {
    t.n += 1;
    if (ok) t.right += 1;
    else if (t.wrong.length < 8) t.wrong.push(cy);
  };

  for (const { cy, script } of rowsIn) {
    for (const ending of endings) {
      if (!cy.endsWith(ending)) continue;
      const raw = cy.slice(0, -ending.length);
      const head = raw.endsWith('ь') ? `${raw.slice(0, -1)}и` : raw;
      if (head.length < 3) continue;
      if (runtime.has(head)) break;
      const last = head[head.length - 1];
      const slot = head[head.length - 2];
      const before = head[head.length - 3];
      if (VOWELS.has(last)) {
        if (!'жчш'.includes(slot) || !'аэоө'.includes(last)) continue;
        const stem = `${head.slice(0, -1)}и`;
        if (!runtime.has(stem)) continue;
        count(absorbed, begins(script, stem), cy);
        break;
      }
      if (!VOWELS.has(slot) || slot === 'й') continue;
      const swapped = known(STEM_VOWELS.map((v) => `${head.slice(0, -2)}${last}${v}`));
      if (swapped.length === 0) continue;
      const appended = known(STEM_VOWELS.map((v) => `${head}${v}`));
      const ok = swapped.some((stem) => begins(script, stem));
      if (VOWELS.has(before) || !EPENTHETIC.has(slot)) {
        count(exchanged.long, ok, cy);
      } else if (appended.length > 0) {
        both.n += 1;
        if (appended.some((stem) => begins(script, stem))) both.appended += 1;
        if (ok) both.exchanged += 1;
      } else {
        count(exchanged.only, ok, cy);
        const byLetter = exchanged.across.get(last) ?? tally();
        count(byLetter, ok, cy);
        exchanged.across.set(last, byLetter);
      }
      break;
    }
  }

  const show = (t) =>
    `${t.right} of ${t.n}${t.n ? ` (${Math.round((100 * t.right) / t.n)}%)` : ''}`;
  console.log(`stems ${runtime.size}   corpus rows ${rowsIn.length}   endings ${endings.length}`);
  console.log(`${loanwords} rows skipped as loanwords, ${skipped} as held out.\n`);
  console.log('Vowel exchanged across the final consonant (учир → учра):');
  console.log(`  no other completion      right ${show(exchanged.only)}`);
  for (const [letter, t] of [...exchanged.across].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`    across ${letter}               right ${show(t)}   ${t.wrong.join(' ')}`);
  }
  console.log(
    `  a vowel also appends     ${both.n} heads: appended right ${both.appended},` +
      ` exchanged right ${both.exchanged}`,
  );
  console.log(`  long vowel in the slot   right ${show(exchanged.long)}`);
  console.log('Absorbed и after ж/ч/ш (бичэ → бичи):');
  console.log(`  right ${show(absorbed)}   ${absorbed.wrong.join(' ')}`);
  process.exit(0);
}

const pairs = new Map();
const cells = new Map();
const how = { exact: 0, 'soft-sign': 0, restored: 0, metathesis: 0 };
let matched = 0;
const bump = (map, key, clSuffix, example) => {
  const byCl = map.get(key) ?? new Map();
  const cell = byCl.get(clSuffix) ?? { n: 0, ex: [] };
  cell.n += 1;
  if (cell.ex.length < (ENDINGS.length > 0 ? 6 : 3)) cell.ex.push(example);
  byCl.set(clSuffix, cell);
  map.set(key, byCl);
};

/** The letter an ending follows, with every vowel folded to `V`. */
const hostOf = (letter) => (VOWELS.has(letter) ? 'V' : letter);
const hosts = new Map();

for (const { cy, script } of rowsIn) {
  if (stems.has(cy.slice(0, -1)) && cy.endsWith('х')) continue;
  const a = analyse(cy, script);
  if (a === undefined) continue;
  if (a.unconfirmed) {
    bump(hosts, `${a.cySuffix}\t${hostOf(a.host)}`, '≠stem', cy);
    continue;
  }
  matched += 1;
  how[a.how] += 1;
  const example = `${cy} = ${a.cy}+${a.cySuffix} → ${a.cl}+${a.clSuffix}`;
  bump(pairs, a.cySuffix, a.clSuffix, example);
  const harmony = harmonyOf(cy) === 'masculine' ? 'masc' : 'fem';
  bump(cells, `${a.cySuffix}\t${harmony}\t${classOf(a.cl)}`, a.clSuffix, example);
  bump(hosts, `${a.cySuffix}\t${hostOf(cy[cy.length - a.cySuffix.length - 1])}`, a.clSuffix, cy);
}

console.log(
  `verb stems ${stems.size}   corpus rows ${rowsIn.length}   stem-matched ${matched}` +
    `   (exact ${how.exact}, soft sign ${how['soft-sign']}, vowel restored ${how.restored},` +
    ` metathesis ${how.metathesis})`,
);
console.log(`${loanwords} rows skipped as loanwords.`);
console.log(
  skipped > 0
    ? `${skipped} rows skipped: held out in test/fixtures/verb-gold.json or the attested` +
        ' held-out sample. Pass --include-held-out to reproduce counts mined before 2026-07-29.\n'
    : '',
);

const summarise = (byCl) => {
  const total = [...byCl.values()].reduce((a, c) => a + c.n, 0);
  const sorted = [...byCl].sort((a, b) => b[1].n - a[1].n);
  return { total, sorted, share: sorted[0][1].n / total };
};

const ranked = [...pairs]
  .map(([cySuffix, byCl]) => ({ cySuffix, ...summarise(byCl) }))
  .filter((r) => (ENDINGS.length > 0 ? ENDINGS.includes(r.cySuffix) : r.total >= MIN))
  .sort((a, b) => b.total - a.total);

const line = (label, { total, sorted, share }) => {
  const others = sorted
    .slice(1, ENDINGS.length > 0 ? 6 : 3)
    .map(([k, v]) => `${k}(${v.n})`)
    .join(' ');
  return `${label} ${String(total).padStart(5)}  ${sorted[0][0].padEnd(14)} ${(100 * share).toFixed(0).padStart(4)}%  ${others}`;
};

const shown = ALL || ENDINGS.length > 0 ? ranked : ranked.slice(0, 40);
console.log(
  `${'cyrillic'.padEnd(10)} ${'n'.padStart(5)}  ${'classical'.padEnd(14)} share  runners-up`,
);
for (const r of shown) {
  console.log(line(r.cySuffix.padEnd(10), r));
  if (!SPLIT) continue;
  const mine = [...cells]
    .filter(([key]) => key.split('\t')[0] === r.cySuffix)
    .map(([key, byCl]) => ({ key, byCl, ...summarise(byCl) }))
    .sort((a, b) => b.total - a.total);
  for (const cell of mine) {
    const [, harmony, stemClass] = cell.key.split('\t');
    console.log(line(`  ${harmony.padEnd(4)} ${stemClass.padEnd(5)}`.padEnd(14), cell));
    if (ENDINGS.length === 0) continue;
    for (const [cl, v] of cell.sorted) console.log(`      ${cl}: ${v.ex.join('; ')}`);
  }
  if (!HOSTS) continue;
  const after = [...hosts]
    .filter(([key]) => key.split('\t')[0] === r.cySuffix)
    .map(([key, byCl]) => ({ host: key.split('\t')[1], ...summarise(byCl) }))
    .sort((a, b) => b.total - a.total);
  for (const h of after) {
    const readings = h.sorted
      .map(([cl, v]) => `${cl}(${v.n}${cl === '≠stem' ? `: ${v.ex.join(' ')}` : ''})`)
      .join(' ');
    console.log(`  after ${h.host.padEnd(2)} ${String(h.total).padStart(5)}  ${readings}`);
  }
}
console.log(
  `\n${ranked.length} endings at >=${MIN} attestations. Most are DERIVATIONAL (-лт → lta,`,
);
console.log('-гч → γči) and belong in the lexicon as their own lemmas, not in a suffix table.');
console.log('Promote an ending only when the count and the share both hold up.');
