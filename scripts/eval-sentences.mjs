#!/usr/bin/env node
/**
 * Agreement with the silver on whole SENTENCES, word by word.
 *
 *   pnpm build && node scripts/eval-sentences.mjs [--dist DIR] [--misses N]
 *
 * Every other score here asks about a word alone. This one converts a sentence
 * and compares each word with what the silver wrote for the same sentence,
 * so it sees what the others cannot: the clitic split, a suffix after a number
 * or an acronym, and a word the silver writes differently in context.
 *
 * Reads `.tmp/harvest-sentences.jsonl` (the sentences) and
 * `.tmp/harvest-harvest.jsonl` (word answers, used only to anchor the
 * alignment), both written by `scripts/standardize-silver.mjs`. A missing
 * file is a skip, not a failure.
 *
 * ⚠ **The sentences must be ones the `attested` tier never learned from.**
 * `standardize-silver.mjs` keeps `--context` and `--sentences` apart for
 * this; score a set that was also passed as `--context` and the words being
 * scored were read from it.
 *
 * ## What is counted
 *
 * - **Units come from the aligner** (`lib/align.mjs`). A unit is scored only
 *   where the alignment is pinned down; a merge it cannot place is left out
 *   and shows up as the gap between "word tokens" and "aligned".
 * - **Letters and selectors are compared, connectors are not.** MVS against a
 *   fused suffix is house style — a reader ruled both spellings correct — so
 *   counting it would measure a choice, not an error.
 * - **A sentence agrees** when every one of its words was aligned and every
 *   one matches. Sentences with an unaligned word are not in that
 *   denominator.
 *
 * `--dist` scores another build over the same sentences — the "before" column.
 *
 * ⚠ Silver, like everything measured against the silver. It says how far
 * this converter is from that one, in running text.
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
const DIST = resolve(ROOT, flag('--dist', 'dist'));
const SHOW = Number(flag('--misses', 0));
const SENTENCES = resolve(ROOT, '.tmp/harvest-sentences.jsonl');
const WORDS = resolve(ROOT, '.tmp/harvest-harvest.jsonl');

for (const file of [SENTENCES, WORDS]) {
  if (!existsSync(file)) {
    console.log(`needs ${file} — not present, skipping`);
    process.exit(0);
  }
}

const { analyze } = await import(pathToFileURL(resolve(DIST, 'index.js')).href);
const A = await import(pathToFileURL(resolve(ROOT, 'scripts/lib/align.mjs')).href);
const { scriptOf } = await import(pathToFileURL(resolve(ROOT, 'scripts/lib/silver.mjs')).href);

const readJsonl = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line) => {
      if (!line) return [];
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });

/** Hudum letters and selectors only: what two spellings of a word are compared by. */
const letters = (script) =>
  [...script]
    .filter((c) => {
      const cp = c.codePointAt(0) ?? 0;
      return (cp >= 0x1820 && cp <= 0x1842) || (cp >= 0x180b && cp <= 0x180d) || cp === 0x180f;
    })
    .join('');

/**
 * The silver joins the clitics ni / mini / čini with MVS; the pipeline
 * writes them as words. Left joined, every "word нь" would align as a 2:1
 * merge, so for the alignment the three are put back after a space.
 */
const CLITIC =
  /\u180E(\u1828\u1822|\u182E\u1822\u1828\u1822|\u1834\u1822\u1828\u1822)(?![\u1820-\u1842]|[\u180B-\u180F])/g;

const oracle = new Map(readJsonl(WORDS).map((r) => [r.cyrillic, scriptOf(r)]));
const silverRows = [...oracle].map(([cyrillic, unicode]) => ({ cyrillic, unicode }));
const { align } = A.createAligner({ splittable: A.splitTailsFrom(silverRows) });

/** Our output for each whitespace-separated Cyrillic token of `text`. */
function oursByToken(text) {
  const cps = [...text];
  const spans = [];
  let start = -1;
  for (let i = 0; i <= cps.length; i += 1) {
    const blank = i === cps.length || /[ \n\r\t]/.test(cps[i]);
    if (!blank && start < 0) start = i;
    if (blank && start >= 0) {
      spans.push([start, i]);
      start = -1;
    }
  }
  const out = spans.map(() => '');
  for (const a of analyze(text)) {
    if (a.token.kind !== 'word') continue;
    // A token made by the clitic split shares its host's span.
    const at = spans.findIndex(([b, e]) => a.token.start >= b && a.token.start < e);
    if (at >= 0) out[at] += a.candidates[0]?.script ?? '';
  }
  return out;
}

const t = { sentences: 0, words: 0, scored: 0, ok: 0, aligned: 0, agreeing: 0 };
const misses = new Map();

for (const row of readJsonl(SENTENCES)) {
  if (typeof row.unicode !== 'string') continue;
  const tok = A.tokenise({ ...row, unicode: row.unicode.replace(CLITIC, ' $1') });
  const assigned = align(tok, (k) => oracle.get(k));
  const ours = oursByToken(row.cyrillic);
  const words = tok.keys.filter(Boolean).length;
  t.sentences += 1;
  t.words += words;
  let scored = 0;
  let ok = 0;
  const seen = new Set();
  for (const a of assigned) {
    if (!a || seen.has(`${a.i}|${a.j}`)) continue;
    seen.add(`${a.i}|${a.j}`);
    const theirs = letters(tok.scr.slice(a.j, a.j + a.ds).join(''));
    if (!theirs) continue;
    const mine = letters(ours.slice(a.i, a.i + a.dc).join(''));
    scored += a.dc;
    if (theirs === mine) ok += a.dc;
    else {
      const key = tok.keys.slice(a.i, a.i + a.dc).join(' ');
      const m = misses.get(key) ?? { n: 0, theirs, mine };
      m.n += 1;
      misses.set(key, m);
    }
  }
  t.scored += scored;
  t.ok += ok;
  if (scored === words) {
    t.aligned += 1;
    if (ok === scored) t.agreeing += 1;
  }
}

const pct = (a, b) => (b === 0 ? 'n/a' : `${((100 * a) / b).toFixed(1)}%`);
console.log(`build: ${DIST}`);
console.log(
  `sentences ${t.sentences}, word tokens ${t.words}, aligned ${t.scored} (${pct(t.scored, t.words)})`,
);
console.log(
  `  WORDS agreeing with the silver      ${String(t.ok).padStart(6)}   ${pct(t.ok, t.scored)}`,
);
console.log(
  `  SENTENCES agreeing, every word         ${String(t.agreeing).padStart(6)}   ${pct(t.agreeing, t.aligned)}   of ${t.aligned} fully aligned`,
);

if (SHOW > 0) {
  const { fromScript } = await import(pathToFileURL(resolve(DIST, 'romanize.js')).href);
  const rom = (script) => {
    try {
      return fromScript(script);
    } catch {
      return '?';
    }
  };
  console.log(`\ntop ${SHOW} disagreements — a QUEUE, not an error list:`);
  for (const [key, m] of [...misses].sort((a, b) => b[1].n - a[1].n).slice(0, SHOW)) {
    console.log(
      `  ${key.padEnd(18)} ${String(m.n).padStart(4)}  ours=${rom(m.mine)}  ref=${rom(m.theirs)}`,
    );
  }
}
