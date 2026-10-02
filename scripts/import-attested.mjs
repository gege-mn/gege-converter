#!/usr/bin/env node
/**
 * Import the `attested` tier: whole Cyrillic words as the silver
 * writes them, kept only where that differs from what the pipeline derives.
 *
 *   node scripts/import-attested.mjs [out.ts] [--silver FILE] [--min-freq N]
 *                                    [--no-fixture] [--withhold-gold]
 *
 * ## What this tier is, and why it is not more `harvested` rows
 *
 * `harvested` rows are STEMS. They went in through a lemma gate, and anything
 * that looked inflected was routed to the gold fixture instead, because a
 * stored inflected form "inflates coverage and hides the fact that the pipeline
 * could not have derived it". That was the right call for a 31k-silver word list
 * built from lemma lists. It leaves the pipeline deriving every inflected form
 * in running text from a stem, and the derivation is where the loss is: over
 * the 9,000 commonest words of a 133M-token corpus the pipeline and the
 * silver disagree on 12.6% of tokens, and an independent silver set
 * sides with the silver about five times in six.
 *
 * So this tier stores the WORD. An `attested` row claims only "this exact word
 * is spelled so". `stem.ts` asks it first for a whole word and LAST as a stem —
 * after every real stem, before `toli` — so a row does not capture a longer
 * word the way a `toli` headword once did (хэлэн + д) unless nothing better
 * reads it. That last-resort use is still a use, and the second pass below
 * exists because of it.
 *
 * ## Only the disagreements are stored
 *
 * A row that repeats the derivation is dead weight, so a word is stored only
 * when the pipeline — with this tier emptied, see below — emits something else.
 * That keeps the file to a fraction of the silver set and makes every row a
 * statement: "the derivation was wrong here".
 *
 * ## ⚠ The tier must not judge itself
 *
 * `dist/` already contains the previous generation of this file. Asking that
 * build what the pipeline derives would let last run's rows answer for
 * themselves, every stored word would look derivable, and the next run would
 * drop it — the same non-idempotence `import-toli.mjs` documents. The live
 * index is a `Map`, so it is emptied in memory before anything is analysed.
 *
 * ## Letters are the silver's; connectors and ruled classes are ours
 *
 * The silver is the authority on which LETTERS a word has. It is not the
 * authority on three things, and each has its own exit below:
 *
 * 1. **Connectors and attachment.** MVS against a fused suffix, -тай³ joined or
 *    detached — a bichig reader ruled both spellings correct and the choice a
 *    house style (docs/rulings.md, 2026-08-10). Where one of our own
 *    real-stem readings spells the same letters, ours is kept.
 * 2. **Reader-ruled classes** — `RULED` below. Each entry cites the verdict in
 *    `test/rulings.test.ts` it protects. The silver follows another
 *    convention there, systematically, so importing its form would overturn a
 *    ruling for every other word of the class.
 * 3. **Curated words.** A key in `lexicon.ts` is never imported: `lexicon`
 *    outranks everything, by definition.
 *
 * ## Holdout discipline — and one deliberate departure from `import-toli.mjs`
 *
 * Two things are withheld:
 *
 * 1. **Every word a test can assert on.** Each `test/*.test.ts` is stripped of
 *    comments and scraped for the Cyrillic inside its string literals. A test
 *    is a specification — most of them a reader's — so the silver does not
 *    get to overrule one. Over-matching within that is free: a word the
 *    pipeline already converts as the test demands would have had no row
 *    anyway. Words that only appear in a test's commentary are not withheld.
 * 2. **A held-out sample**, written by this script: 3% of silver words
 *    outside the 5,000 commonest, drawn by hash so it is stable across runs.
 *    Answered by the silver and never stored, they are the only measurement
 *    of what this import does for a word it has not seen.
 *
 * ⚠ The two older gold fixtures are **not** withheld, and that is the
 * departure. `import-toli.mjs` keeps their surface forms out of its tier,
 * rightly: a gold form stored as a *stem* is the runtime memorising the test.
 * But those fixtures are full of common words — манай, билээ, эхний, эмэгтэй —
 * and withholding them here would leave about seven hundred frequent words
 * converting wrongly for good in order to protect a metric. The metric is
 * protected the other way instead: everything that scores a gold fixture
 * empties this tier first (`scripts/lib/derivation.mjs`), so the fixtures go on
 * measuring derivation and the package ships the rows. `--withhold-gold`
 * restores the stricter rule.
 *
 * ## How deep to go
 *
 * A row is worth storing while the silver is better than the derivation it
 * replaces, and it was not obvious that holds all the way down a frequency
 * list: a rare "word" is as often a typo or a name as a word, and the
 * silver is guessing at it too. So it was measured, against an independent
 * silver, over every silver word the two disagree on — words only the
 * silver gets right, against words only our derivation does, by how often
 * the word occurs in the 133M-token corpus:
 *
 *   occurrences     silver only   ours only   ratio
 *   5,000 and up         183             29       6.3
 *   1,000 – 5,000        375             76       4.9
 *   400 – 1,000          340             86       4.0
 *   200 – 400            342            119       2.9
 *   50 – 200             815            399       2.0
 *   20 – 50              642            299       2.1
 *   10 – 20              500            245       2.0
 *   5 – 10               293            131       2.2
 *
 * It thins from six to one down to two to one, and then it holds: at the
 * bottom of a 200,000-word list the silver is still right twice as often as
 * we are, because what it replaces down there is mostly the guesser. So the
 * default is no floor. `--min-freq N` skips anything rarer — not stored, not
 * held out — for a silver set that goes deep enough to need one.
 *
 * `test/attested.test.ts` asserts the tier is disjoint from the test words and
 * from the held-out sample. A holdout filter that has never rejected anything
 * is not known to work; the ledger this prints says how many each gate
 * rejected.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--silver', '--min-freq']);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const positional = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1] ?? ''));
const OUT = resolve(ROOT, positional ?? 'src/data/attested-forms.ts');
const SILVER = resolve(ROOT, flag('--silver', '.tmp/harvest-harvest.jsonl'));
const FIXTURE = resolve(ROOT, 'test/fixtures/attested-heldout.json');
const WRITE_FIXTURE = !args.includes('--no-fixture');
const WITHHOLD_GOLD = args.includes('--withhold-gold');
/**
 * Words rarer than this in the corpus the word list came from are not
 * imported. Off by default — see "How deep to go" in the header for why.
 */
const MIN_FREQ = Number(flag('--min-freq', 0));

if (!existsSync(resolve(ROOT, 'dist/index.js'))) {
  console.error('needs a build first: pnpm build');
  process.exit(1);
}
if (!existsSync(SILVER)) {
  console.error(`missing ${SILVER} — the silver word list, rows of {cyrillic, unicode, freq}`);
  process.exit(1);
}

const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { analyze } = await load('dist/index.js');
const { toScript, wordsToScript, scriptToWords } = await load('dist/romanize.js');
const { scriptOf } = await load('scripts/lib/silver.mjs');
const { lexiconIndex } = await load('dist/data/lexicon.js');
const { attestedIndex } = await load('dist/data/attested-forms.js');

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

// The tier must not judge itself — see the header.
attestedIndex.clear();

// ------------------------------------------------------------------- holdout

const cyrillicRuns = (text) =>
  [...text.matchAll(/[а-яөүёА-ЯӨҮЁ]{2,}/g)].map((m) => m[0].toLowerCase());

/**
 * Cyrillic words a test file's CODE contains — what it can assert on.
 *
 * Comments are stripped first. The first version of this gate took every
 * Cyrillic run in the file, and prose is full of words: гээд appears in one
 * test's commentary and nowhere in its code, and for that the 160,000-token
 * word гээд was withheld and went on converting as гээ + dative. A word that
 * is only talked about is not specified.
 *
 * What is left is taken whole, not parsed for string literals. The second
 * version paired up quotes, and a regex literal with a quote in it — this very
 * extraction, copied into `test/attested.test.ts` — threw the pairing off for
 * the rest of the file, so words in every later string were silently not
 * withheld. Nothing but a literal can hold Cyrillic in code anyway.
 *
 * Deliberately loose in the other direction — a title string counts, and so
 * does a word a test only passes through `segment` — because the cost of
 * over-matching here is a row the pipeline was already getting right.
 *
 * ⚠ `test/attested.test.ts` repeats this extraction to check the shipped
 * tier against it. Change one and change the other.
 */
const assertedWords = (source) =>
  cyrillicRuns(
    source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '')
      .replace(/[ \t]\/\/ .*$/gm, '')
      // A row a test INJECTS (`withRow('word', …)` in test/attested.test.ts)
      // is not a word it asserts on. Counting it withheld эмэгтэй — 50,947
      // occurrences — from the tier for the sake of a test about эмэгтэйгээ.
      .replace(/\bwith(?:out)?Row\(\s*'[^']*'/g, ''),
  );

/** Every Cyrillic word a test file can assert on. A test is a specification. */
const testWords = new Set(
  readdirSync(resolve(ROOT, 'test'))
    .filter((f) => f.endsWith('.test.ts') || f.endsWith('.test.mjs'))
    .flatMap((f) => assertedWords(readFileSync(resolve(ROOT, 'test', f), 'utf8'))),
);

/**
 * What a reader said a word should be, where a test records it: the confirmed
 * `same('word', 'classical')` rows and the `it.todo` rows, which are verdicts
 * we do not produce yet. A todo is written two ways — `'word → classical'` and
 * `'word is classical — why'` — and may name two words or, for a homograph,
 * two answers (`'хийн is qei-yin (of gas) or qin'`), so a word maps to a set.
 *
 * A test word is withheld so the silver cannot overrule a specification.
 * Where the silver AGREES with the reader there is nothing to overrule, and
 * withholding it only keeps a known-wrong word wrong: чадах is a standing todo
 * (`čidaqu`), the silver writes exactly that, and the gate was the one thing
 * stopping the word from being right.
 */
const readerAnswers = new Map();
{
  const answer = (cyrillic, classical) => {
    try {
      const script = wordsToScript(classical);
      // Prose after the word ("→ stem дун, so …") is not a romanization.
      if (/[а-яөүё]/i.test(classical) || !/^(?:[\u1820-\u1842]|[\u180B-\u180F]| )+$/.test(script))
        return;
      const known = readerAnswers.get(cyrillic) ?? new Set();
      readerAnswers.set(cyrillic, known.add(script));
    } catch {
      // a todo whose text is prose
    }
  };
  const rulings = readFileSync(resolve(ROOT, 'test/rulings.test.ts'), 'utf8');
  for (const m of rulings.matchAll(/same\(\s*'([а-яөүё]+)'\s*,\s*'([^']+)'\s*\)/g))
    answer(m[1], m[2]);
  for (const todo of rulings.matchAll(/it\.todo\(\s*'([^']+)'/g)) {
    for (const m of todo[1].matchAll(
      /([а-яөүё]+) (?:→|is|stays) ([^\s,(—]+)(?: \([^)]*\))?(?: or ([^\s,(—]+))?/g,
    )) {
      answer(m[1], m[2]);
      if (m[3] !== undefined) answer(m[1], m[3]);
    }
  }
}

/** The two gold fixtures — withheld only on request, see the header. */
const goldWords = new Set(
  WITHHOLD_GOLD
    ? ['test/fixtures/harvested-inflected.json', 'test/fixtures/verb-gold.json'].flatMap((f) =>
        JSON.parse(readFileSync(resolve(ROOT, f), 'utf8')).entries.map((g) =>
          g.cyrillic.toLowerCase(),
        ),
      )
    : [],
);

/** Words at or above this frequency rank are too common to withhold. */
const HOLDOUT_FROM_RANK = 5000;
/** Percent of the remaining words withheld. */
const HOLDOUT_PERCENT = 3;

/**
 * Stable across runs and across silver sets: a word is in the sample or it is
 * not, whatever else is in the set beside it. The salt keeps this draw
 * independent of any other hash-split made over the same words.
 */
const inSample = (word) =>
  createHash('sha1').update(`holdout:${word}`).digest().readUInt32BE(0) % 100 < HOLDOUT_PERCENT;

// ------------------------------------------------------------- ruled classes

/** A reading built on a stem a real source attests — not `toli`, not a guess. */
const real = (c) => c.provenance === 'lexicon' || c.provenance === 'harvested';

/**
 * Is a reading of OURS fit to store? The silver's form is linted on the way
 * in; one of our own candidates was not, and a reading that lost the ranking
 * can be malformed — that may be why it lost. Six such rows shipped before
 * this was checked.
 */
const clean = (classical) => {
  try {
    return !lint(wordsToScript(classical)).some((d) => d.severity !== 'info');
  } catch {
    return false;
  }
};

/** Connectors and spaces removed: what is left is the word's letters and selectors. */
const letters = (script) => script.replace(/[\u180E\u202F ]/g, '');

/**
 * Classes where a bichig reader has ruled and the silver follows another
 * convention. `test(cyrillic, ours, theirs)` gets our candidate and the
 * silver's Classical form; a hit keeps ours.
 *
 * ⚠ Narrow on purpose. Each of these was found by asking what a blind import
 * would have stored for the reader-ruled words themselves — eighteen of 160
 * come back with different letters — and then keeping only the cases that are
 * a CLASS rather than one word. The single words are curated rows already.
 */
const RULED = [
  {
    name: 'chachlag-genitive',
    // хэмжээний `qemǰiyen-ü`, борооны `boruγan-u`. A chachlag stem takes its
    // тогтворгүй н in the genitive; the silver writes `-a-yin`/`-e-yin`.
    // Deliberately NOT every -ны/-ний: on a plain vowel-final stem (цайны,
    // бууны) and on loanwords (банкны, киноны) the silver's `-yin` is
    // lexical knowledge of an exception the default cannot see.
    test: (cy, ours, theirs) =>
      /н(ы|ий)$/.test(cy) && /n-[uü]$/.test(ours.classical) && /-[ae]-yin$/.test(theirs),
  },
  {
    name: 'plural-after-n',
    // мэргэжилтнүүд `merγeǰilten-üd`, reader-supplied. The silver writes
    // `-nuγud`. ⚠ An open question in docs/roadmap.md — the gold fixture
    // disagrees with the reader 37 to 1 — so this follows the one verdict there
    // is and should be revisited when the reader is asked.
    // Wherever the plural sits in the word, not only at its end: настнуудад
    // carries a dative after it and is the same question.
    test: (cy, ours, theirs) =>
      /н(ууд|үүд)/.test(cy) &&
      /n-[uü]d(-|$)/.test(ours.classical) &&
      /n-?n[uü]1?[γg][uü]d(-|$)/.test(theirs),
  },
  {
    name: 'reflexive-after-linking-ng',
    // тахингаа `taq-a-ban`, өнгөлөнгөө `öngγele-ben`.
    test: (cy, ours, theirs) =>
      /нг(аа|ээ|оо|өө)$/.test(cy) && /-b[ae]n$/.test(ours.classical) && !/-b[ae]n$/.test(theirs),
  },
];

/**
 * Stems a reader has ruled on, from `same('word', 'classical')` in the rulings.
 *
 * A ruling on a bare word is a ruling on its stem, and the silver does not
 * know about it: it spells найм `naima` where the reader gave `nay1ma`, тав
 * `tabu` against `tabun`. The bare words are safe — they are test words and
 * are never imported — but their inflections are not, and наймд would come in
 * as `naima-du`, quietly undoing the ruling one case form at a time.
 *
 * So where our reading stands on a ruled stem and the silver's form is the
 * SAME suffix chain on a differently spelled stem, ours is kept. Deliberately
 * no wider than that: a curated stem the reader has not ruled on gets no such
 * protection, because most of the time the silver is right about those —
 * нарт is the plural, not "to the sun"; хаанаас is "from where", not "from the
 * king" — and the curated row was only ever the wrong word.
 */
const ruledStems = new Map(
  [
    ...readFileSync(resolve(ROOT, 'test/rulings.test.ts'), 'utf8').matchAll(
      /same\(\s*'([а-яөүё]+)'\s*,\s*'([^']+)'\s*\)/g,
    ),
  ].flatMap((m) => {
    try {
      return [[m[1], toScript(m[2])]];
    } catch {
      return [];
    }
  }),
);

/** Our reading, if it is a ruled stem plus the very suffix chain the silver wrote. */
const onRuledStem = (candidates, script) =>
  candidates.find((c) => {
    if (c.provenance !== 'lexicon' || c.segmentation.suffixes.length === 0) return false;
    const stem = ruledStems.get(c.segmentation.stem);
    if (stem === undefined || !c.script.startsWith(stem)) return false;
    const chain = c.script.slice(stem.length);
    return chain.startsWith('\u180E') && script.endsWith(chain) && !script.startsWith(stem);
  });

// -------------------------------------------------------------------- import

const rows = [];
for (const line of readFileSync(SILVER, 'utf8').split('\n')) {
  if (!line) continue;
  try {
    rows.push(JSON.parse(line));
  } catch {
    // a torn line is not worth failing the run over
  }
}

// Frequency rank among the silver words. A row without `freq` (a word that
// came from a word list rather than from running text) ranks last and is never
// sampled: the held-out set is meant to look like text.
const ranked = rows
  .filter((r) => (r.freq ?? 0) > 0)
  .sort((a, b) => b.freq - a.freq || a.cyrillic.localeCompare(b.cyrillic));
const rank = new Map(ranked.map((r, i) => [r.cyrillic, i]));

const stats = {
  rows: rows.length,
  notCyrillic: 0,
  tooRare: 0,
  curated: 0,
  testWord: 0,
  goldWithheld: 0,
  heldOut: 0,
  multiToken: 0,
  dirty: 0,
  roundTripFailed: 0,
  agrees: 0,
  houseConnector: 0,
  ruled: { 'ruled-stem': 0, ...Object.fromEntries(RULED.map((r) => [r.name, 0])) },
  storedTheirs: 0,
  storedOurs: 0,
  oursDirty: 0,
  shadowed: 0,
  shadowedSplit: 0,
};
const accepted = new Map();
const heldOut = [];
/** Words whose own derivation was judged good enough to need no row: word → that reading. */
const derived = new Map();

for (const r of rows) {
  const cyrillic = r.cyrillic;
  if (typeof cyrillic !== 'string' || !/^[а-яёөү]+$/.test(cyrillic)) {
    stats.notCyrillic += 1;
    continue;
  }
  if ((r.freq ?? 0) < MIN_FREQ) {
    stats.tooRare += 1;
    continue;
  }
  if (lexiconIndex.has(cyrillic)) {
    stats.curated += 1;
    continue;
  }
  const script = scriptOf(r);
  if (testWords.has(cyrillic) && readerAnswers.get(cyrillic)?.has(script) !== true) {
    stats.testWord += 1;
    continue;
  }
  if (goldWords.has(cyrillic)) {
    stats.goldWithheld += 1;
    continue;
  }

  // One word in, several out: the silver split it. Mostly that is X үгүй,
  // which the clitic split already writes the same way and which therefore
  // "agrees" below like any other word. Where it does not — юмуу is `yum uu`,
  // улстөрийн is `ulus törü-yin`, болоогүй has a host we get wrong — the row
  // carries the space. A reader, shown юмуу: "there's no such word … so maybe
  // follow them."
  if (script.includes(' ')) stats.multiToken += 1;
  if (lint(script).some((d) => d.severity !== 'info')) {
    stats.dirty += 1;
    continue;
  }
  let theirs;
  try {
    theirs = scriptToWords(script);
    if (wordsToScript(theirs) !== script) throw new Error('round trip');
  } catch {
    stats.roundTripFailed += 1;
    continue;
  }

  // Withheld AFTER the cleanliness gates, so every held-out entry is a pair
  // the tier would otherwise have been allowed to store.
  const at = rank.get(cyrillic);
  if (at !== undefined && at >= HOLDOUT_FROM_RANK && inSample(cyrillic)) {
    stats.heldOut += 1;
    heldOut.push({ cyrillic, classical: theirs, freq: r.freq });
    continue;
  }

  const tokens = analyze(cyrillic);
  const emitted = tokens.map((t) => t.candidates[0]?.script ?? t.token.text).join('');
  // Whatever is decided below, a word that ends up without a row is relying on
  // this reading staying on top — see the second pass.
  const top = tokens.length === 1 ? tokens[0].candidates[0] : undefined;
  derived.set(cyrillic, { script: emitted, classical: top?.classical });
  if (emitted === script) {
    stats.agrees += 1;
    continue;
  }

  // A reader's own answer for this very word, and the silver wrote exactly
  // that. It outranks everything below: the connector exit (a ruling is
  // code-point exact) and the ruled CLASSES, which generalise a verdict on one
  // word and yield to a verdict on another — гэрээний is `ger-e-yin` by
  // ruling, inside the very class хэмжээний `qemǰiyen-ü` founded.
  if (readerAnswers.get(cyrillic)?.has(script) === true) {
    accepted.set(cyrillic, theirs);
    stats.storedTheirs += 1;
    continue;
  }

  if (tokens.length === 1) {
    const candidates = tokens[0].candidates;
    const sameLetters = candidates.find((c) => real(c) && letters(c.script) === letters(script));
    if (sameLetters !== undefined) {
      if (sameLetters === candidates[0]) {
        stats.houseConnector += 1;
      } else if (clean(sameLetters.classical)) {
        // Our own reading has the silver's letters but lost the ranking.
        accepted.set(cyrillic, sameLetters.classical);
        stats.storedOurs += 1;
      } else {
        // …and is malformed. The silver's spelling has the same letters and
        // passed the lint above, so it is the one to keep.
        accepted.set(cyrillic, theirs);
        stats.oursDirty += 1;
        stats.storedTheirs += 1;
      }
      continue;
    }
    const ruledStem = onRuledStem(candidates, script);
    if (ruledStem !== undefined) {
      stats.ruled['ruled-stem'] += 1;
      if (ruledStem !== candidates[0] && clean(ruledStem.classical)) {
        accepted.set(cyrillic, ruledStem.classical);
        stats.storedOurs += 1;
      }
      continue;
    }
    const ruled = RULED.find((rule) =>
      candidates.some((c) => real(c) && rule.test(cyrillic, c, theirs)),
    );
    if (ruled !== undefined) {
      stats.ruled[ruled.name] += 1;
      const ours = candidates.find((c) => real(c) && ruled.test(cyrillic, c, theirs));
      if (ours !== candidates[0] && clean(ours.classical)) {
        accepted.set(cyrillic, ours.classical);
        stats.storedOurs += 1;
      }
      continue;
    }
  } else if (letters(emitted) === letters(script)) {
    // The clitic split wrote the same letters as two words.
    stats.houseConnector += 1;
    continue;
  }

  accepted.set(cyrillic, theirs);
  stats.storedTheirs += 1;
}

// --------------------------------------------------- the rows, judged together
//
// Everything above asked the pipeline with the tier EMPTY. At runtime it is not:
// a row is also a last-resort stem (`stem.ts`), so a stored word can take a
// longer one that was judged fine a moment ago — ингэ's row turned ингээд, which
// derived correctly, into ингэ + dative. The first pass cannot see that, having
// judged each word alone.
//
// So the accepted rows go live and every word that was left without one is
// asked again. Where its answer moved, the reading that was judged is pinned as
// a row of its own. A new row is a new stem, so this repeats until nothing
// moves; rows are only ever added, so it ends.
for (let round = 0; round < 8; round += 1) {
  attestedIndex.clear();
  for (const [cyrillic, classical] of accepted) attestedIndex.set(cyrillic, [classical]);
  let moved = 0;
  for (const [cyrillic, was] of derived) {
    if (accepted.has(cyrillic)) continue;
    const now = analyze(cyrillic)
      .map((t) => t.candidates[0]?.script ?? t.token.text)
      .join('');
    if (now === was.script) continue;
    if (was.classical === undefined || !clean(was.classical)) {
      // Judged as two words (a clitic split) and a row holds one — or the
      // judged reading does not lint. Counted, not fixed.
      stats.shadowedSplit += 1;
      derived.delete(cyrillic);
      continue;
    }
    accepted.set(cyrillic, was.classical);
    stats.shadowed += 1;
    moved += 1;
  }
  if (moved === 0) break;
  if (round === 7) console.error('⚠ the second pass did not settle in 8 rounds');
}
attestedIndex.clear();

const sorted = [...accepted].sort((a, b) => a[0].localeCompare(b[0], 'mn'));
heldOut.sort((a, b) => a.cyrillic.localeCompare(b.cyrillic, 'mn'));

// ---------------------------------------------------------------------- emit

const header = `/**
 * Whole Cyrillic words → Classical, as the silver writes them,
 * encoding-repaired and orthographically normalised like the \`harvested\` tier.
 * GENERATED — do not edit by hand.
 *
 *   node scripts/import-attested.mjs
 *
 * This is the \`attested\` provenance tier. A row here is a whole WORD, not a
 * stem: \`stem.ts\` asks this index first when nothing has been peeled, and as
 * a stem only after every real stem has failed.
 *
 * Only disagreements are stored. A word the pipeline already converts the same
 * way has no row, so a row says the derivation was wrong — or, for the few the
 * importer's second pass adds, that another row used as a stem would have
 * taken the word.
 * Where the difference was only a connector, or fell in a class a bichig reader
 * has ruled on, the row carries OUR reading rather than the silver's — see
 * the script's header.
 *
 * ⚠ Unreviewed, like \`harvested\`. A word a reader has ruled on belongs in
 * \`lexicon.ts\`, which outranks this outright.
 *
 * ${sorted.length} entries, from ${stats.rows} silver words.
 */

/** \`cyrillic classical\`, one pair per line. */
const ROWS = \``;

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

/** Whole Cyrillic word → its attested Classical reading(s), commonest first. */
export const attestedIndex: ReadonlyMap<string, readonly string[]> = index;
`;

writeFileSync(OUT, `${header}\n${sorted.map(([c, k]) => `${c} ${k}`).join('\n')}\n${footer}`);

if (WRITE_FIXTURE) {
  writeFileSync(
    FIXTURE,
    `${JSON.stringify(
      {
        _comment: [
          'silver answers for words WITHHELD from the attested tier. GENERATED by',
          'scripts/import-attested.mjs — do not edit by hand. A stable 3% hash sample',
          'of silver words outside the 5,000 commonest, so it measures what the',
          'pipeline does for a word it has never seen. `freq` is the count in the',
          'corpus the word list came from, for token-weighted scoring.',
        ].join(' '),
        entries: heldOut,
      },
      null,
      2,
    )}\n`,
  );
}

console.log(JSON.stringify(stats, null, 2));
console.log(`\nwrote ${sorted.length} rows to ${OUT}`);
if (WRITE_FIXTURE) console.log(`wrote ${heldOut.length} held-out pairs to ${FIXTURE}`);
console.log('\nrebuild before measuring: pnpm build');
