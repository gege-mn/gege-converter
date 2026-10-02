#!/usr/bin/env node
/**
 * What the converter does for a word the silver set never gave it.
 *
 *   pnpm build && node scripts/eval-heldout.mjs [--misses N]
 *
 * `test/fixtures/attested-heldout.json` is a 3% hash sample of the running-text
 * silver word list, outside the 5,000 commonest words, that
 * `scripts/import-attested.mjs` answers from the silver and then
 * withholds from the `attested` tier. Everything else in that silver set is
 * either stored or already derived correctly, so on ordinary text the tier is
 * close to a lookup — and a lookup says nothing about the next word. This
 * fixture is the part that does.
 *
 * ⚠ "Never seen" is true of the `attested` tier and not of the package. About
 * one held-out word in six is a whole-word row in an OLDER tier — a
 * `harvested` or `toli` stem that happens to be the word — and that is a
 * lookup too. So the table splits them: **stored whole** is those, and
 * **derived** is every word that had to be built from a stem and a suffix, or
 * guessed. `derived` is the number that speaks for the next unseen word.
 *
 * Unlike the two gold fixtures it is scored with the tier **live**: a held-out
 * word is not in it, but its stem may be, and an attested row serving as a
 * last-resort stem or as a verb stem is exactly the generalisation being
 * measured. (The gold fixtures are scored with the tier emptied — see
 * `lib/derivation.mjs` for why the two differ.)
 *
 * Two comparisons are printed, and they answer different questions:
 *
 * - **letters** — MVS removed on both sides. The silver fuses some suffixes
 *   this project detaches (-тай³ above all); a reader ruled both spellings
 *   correct and the choice a house style, so this is the number that says
 *   whether the WORD is right.
 * - **exact** — code point for code point, which additionally counts every
 *   place house style differs from the silver's.
 *
 * ⚠ "Right" here means agreeing with the silver. It is the same
 * silver as `harvested`, not a reader's verdict.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { analyze } = await load('dist/index.js');
const { wordsToScript } = await load('dist/romanize.js');
const { lexiconIndex, harvestedIndex } = await load('dist/data/lexicon.js');
const { toliIndex } = await load('dist/data/toli-lexicon.js');
const HELD = [lexiconIndex, harvestedIndex, toliIndex];

const args = process.argv.slice(2);
const missesAt = args.indexOf('--misses');
const showMisses = missesAt >= 0 ? Number(args[missesAt + 1] ?? 30) : 0;

const entries = JSON.parse(
  readFileSync(resolve(ROOT, 'test/fixtures/attested-heldout.json'), 'utf8'),
).entries;

const MVS = /\u180E/g;
const letters = (script) => script.replace(MVS, '');
const cell = () => ({ n: 0, tok: 0, exact: 0, exactTok: 0, letters: 0, lettersTok: 0 });
const all = cell();
const storedWhole = cell();
const derived = cell();
const tiers = new Map();
const misses = [];

for (const e of entries) {
  const want = wordsToScript(e.classical);
  const tokens = analyze(e.cyrillic);
  const got = tokens.map((t) => t.candidates[0]?.script ?? t.token.text).join('');
  const tier = tokens[0]?.candidates[0]?.provenance ?? 'none';
  if (!tiers.has(tier)) tiers.set(tier, cell());
  // A row an older tier holds for this exact word, and the answer came from
  // it: nothing peeled, nothing guessed. (Key membership alone is not enough —
  // ихэр is a row, and the reading that wins is их + эр.)
  const top = tokens.length === 1 ? tokens[0].candidates[0] : undefined;
  const whole =
    top !== undefined &&
    tier !== 'guess' &&
    top.segmentation.suffixes.length === 0 &&
    top.segmentation.stem === e.cyrillic &&
    HELD.some((index) => index.has(e.cyrillic));
  const exact = got === want;
  const same = letters(got) === letters(want);
  for (const c of [all, whole ? storedWhole : derived, tiers.get(tier)]) {
    c.n += 1;
    c.tok += e.freq;
    if (exact) {
      c.exact += 1;
      c.exactTok += e.freq;
    }
    if (same) {
      c.letters += 1;
      c.lettersTok += e.freq;
    }
  }
  if (!same) {
    misses.push({
      ...e,
      tier,
      got: tokens.map((t) => t.candidates[0]?.classical ?? t.token.text).join(' '),
    });
  }
}

const pct = (a, b) => (b === 0 ? '   n/a' : `${((100 * a) / b).toFixed(1)}%`.padStart(6));
const line = (name, c) =>
  `  ${name.padEnd(12)}${String(c.n).padStart(6)}   ${pct(c.letters, c.n)} ${pct(c.lettersTok, c.tok)}     ${pct(c.exact, c.n)} ${pct(c.exactTok, c.tok)}`;

console.log(`held-out words: ${all.n}, never stored in the attested tier\n`);
console.log('                   n     letters            exact');
console.log('                         type   token      type   token');
console.log(line('ALL', all));
console.log(line('stored whole', storedWhole));
console.log(line('derived', derived));
console.log('');
for (const [tier, c] of [...tiers].sort((a, b) => b[1].n - a[1].n)) console.log(line(tier, c));

if (showMisses) {
  console.log(`\ntop ${showMisses} misses by corpus frequency — a QUEUE, not an error list:`);
  for (const m of misses.sort((a, b) => b.freq - a.freq).slice(0, showMisses)) {
    console.log(
      `  ${m.cyrillic.padEnd(18)} ${String(m.freq).padStart(6)} [${m.tier.padEnd(9)}] ours=${m.got}  ref=${m.classical}`,
    );
  }
}
