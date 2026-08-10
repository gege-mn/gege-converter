#!/usr/bin/env node
/**
 * Cross-check our data against Mongolian Wiktionary — a second opinion, not a
 * source.
 *
 *   curl -o .tmp/kaikki-mn.jsonl \
 *     https://kaikki.org/dictionary/Mongolian/kaikki.org-dictionary-Mongolian.jsonl
 *   node scripts/crosscheck-wiktionary.mjs
 *
 * ⚠ This started life as an importer and the measurement killed that. Shipping
 * the extraction as a lexicon tier would have added 31 words worth 351 corpus
 * tokens — 0.078% of running text — and 17 of those are Wiktionary's *suffix*
 * headwords (-аа, -лт, -чин), which in a stem lexicon corrupt lookups outright.
 * Worse, where Wiktionary and the harvested tier disagree, the third
 * independent source (the parallel corpus) sides with harvested 37 times to
 * Wiktionary's 18. It is roughly twice as often wrong as the data we have.
 *
 * What it IS good for is what the agreement literature says agreement is good
 * for: triage. Two independent sources landing on the same form is evidence;
 * two disagreeing is a question worth a reader's time. So this emits a report
 * and nothing here ever reaches `src/data/`.
 *
 * Wiktionary records the bichig in a `forms` row tagged "Mongolian" alongside
 * its own romanization, and the pair is the filter: a row is considered only
 * when `toScript(their romanization)` reproduces their bichig code point for
 * code point. That is CLAUDE.md's "grade in SCRIPT, never in romanization"
 * turned into a gate. The rows that fail it are almost entirely loanwords —
 * Wiktionary writes foreign k as ᠻ and puts FVS1 on ᠲ in телефон/такси — and
 * dropping them is the point, since nothing generalises from foreign words.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IN = '.tmp/kaikki-mn.jsonl';
const OUT = process.argv[2] ?? '.tmp/wiktionary-crosscheck.json';

const { fromScript, toScript } = await import(
  pathToFileURL(resolve(ROOT, 'dist/romanize.js')).href
);
const { normalizeOrthography } = await import(
  pathToFileURL(resolve(ROOT, 'dist/orthography.js')).href
);
const { lexiconIndex, harvestedIndex } = await import(
  pathToFileURL(resolve(ROOT, 'dist/data/lexicon.js')).href
);

if (!existsSync(IN)) {
  console.error(`missing ${IN} — see the header for the curl command`);
  process.exit(1);
}

/** A Classical form carrying a connector is a stem plus a suffix, not a stem. */
const hasSuffixChain = (classical) => {
  const parts = classical.split('-');
  if (parts.length < 2) return false;
  if (parts.length === 2 && /^[ae]$/.test(parts[1])) return false;
  return true;
};

const stats = { entries: 0, usable: 0, affix: 0, agree: 0, conflict: 0, unknown: 0 };
const conflicts = [];
const agreements = [];

for (const line of readFileSync(IN, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let d;
  try {
    d = JSON.parse(line);
  } catch {
    continue;
  }
  stats.entries += 1;

  const form = (d.forms ?? []).find((f) => f.tags?.includes('Mongolian') && f.form && f.roman);
  if (!form) continue;
  if (d.word.includes(' ') || form.roman.includes(' ')) continue;

  // Wiktionary lists affixes as headwords with a leading or trailing hyphen.
  // They are not stems and must never be compared against one.
  if (d.word.startsWith('-') || d.word.endsWith('-')) {
    stats.affix += 1;
    continue;
  }

  let raw;
  try {
    raw = toScript(form.roman);
  } catch {
    continue;
  }
  if (raw !== form.form) continue; // their romanization scheme is not ours here

  const script = normalizeOrthography(raw);
  let classical;
  try {
    classical = fromScript(script);
    if (toScript(classical) !== script) continue;
  } catch {
    continue;
  }
  if (hasSuffixChain(classical)) continue;

  stats.usable += 1;

  const ours = [...(lexiconIndex.get(d.word) ?? []), ...(harvestedIndex.get(d.word) ?? [])];
  if (ours.length === 0) {
    stats.unknown += 1;
    continue;
  }
  const tier = lexiconIndex.has(d.word) ? 'lexicon' : 'harvested';
  const match = ours.some((e) => {
    try {
      return toScript(e.classical) === script;
    } catch {
      return false;
    }
  });
  const row = {
    cyrillic: d.word,
    wiktionary: classical,
    ours: ours.map((e) => e.classical),
    tier,
    pos: d.pos,
  };
  if (match) {
    stats.agree += 1;
    agreements.push(row);
  } else {
    stats.conflict += 1;
    conflicts.push(row);
  }
}

writeFileSync(OUT, JSON.stringify({ conflicts, agreements }, null, 1));

console.log(`read ${stats.entries} Wiktionary headwords`);
console.log(`  affix headwords, skipped   ${String(stats.affix).padStart(5)}`);
console.log(`  usable stem forms          ${String(stats.usable).padStart(5)}`);
console.log(`    we have no row           ${String(stats.unknown).padStart(5)}`);
console.log(`    AGREE with us            ${String(stats.agree).padStart(5)}`);
console.log(
  `    CONFLICT with us         ${String(stats.conflict).padStart(5)}   <- the reader queue`,
);
console.log(`\nwrote ${OUT}`);
