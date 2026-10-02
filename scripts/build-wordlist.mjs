#!/usr/bin/env node
/**
 * Merge every Cyrillic word source we have into one deduplicated list, for
 * feeding to the silver set.
 *
 * Sources are read only if present, so a missing download degrades the list
 * rather than failing the build. Provenance is reported per source so it is
 * always visible which corpus contributed what — the licences differ and are
 * NOT interchangeable:
 *
 *   kaikki.org (Wiktionary)  CC BY-SA 4.0
 *   MonWN                    file header says CC BY 4.0, repo LICENSE says
 *                            CC BY-SA 4.0 — treat as BY-SA until resolved
 *   UniMorph khk             CC BY-SA 3.0
 *
 * All three are share-alike, so the *word list* must not be vendored into an
 * MIT package. What we ship is our own lexicon; these only decide which words
 * get looked up.
 *
 *   node scripts/build-wordlist.mjs [out.txt]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2] ?? '.tmp/cyrillic-words.txt';

/** Khalkha Cyrillic, plus space and hyphen for multiword headwords. */
const CYRILLIC = /^[А-Яа-яЁёӨөҮү][А-Яа-яЁёӨөҮү -]*$/;

const sources = [];
const all = new Map(); // word → first source that supplied it

function add(word, source) {
  const w = word.trim().toLowerCase();
  if (!w || w.length > 40 || !CYRILLIC.test(w)) return false;
  if (all.has(w)) return false;
  all.set(w, source);
  return true;
}

function ingest(name, file, extract) {
  if (!existsSync(file)) {
    sources.push({ name, file, found: false, added: 0 });
    return;
  }
  let added = 0;
  for (const word of extract(readFileSync(file, 'utf8'))) {
    if (add(word, name)) added += 1;
  }
  sources.push({ name, file, found: true, added });
}

// kaikki.org — one JSON object per line, `word` is the headword.
ingest('kaikki (Wiktionary)', '.tmp/kaikki-mn.jsonl', function* (text) {
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line).word ?? '';
    } catch {
      // skip a malformed line
    }
  }
});

// MonWN — Open Multilingual WordNet TSV: synset, field, value. Comments start #.
ingest('MonWN', '.tmp/monwn.tsv', function* (text) {
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const cols = line.split('\t');
    if (cols[1]?.endsWith('lemma') && cols[2]) yield cols[2];
  }
});

// UniMorph — lemma, inflected form, tags. Both first columns are words.
ingest('UniMorph khk', '.tmp/unimorph-khk.tsv', function* (text) {
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols[0]) yield cols[0];
    if (cols[1]) yield cols[1];
  }
});

const list = [...all.keys()].sort();
writeFileSync(OUT, `${list.join('\n')}\n`);

const bytes = Buffer.byteLength(list.join('\n'), 'utf8');
console.log('source                      status      new words');
console.log('-------------------------------------------------');
for (const s of sources) {
  console.log(
    `${s.name.padEnd(26)} ${(s.found ? 'ok' : 'MISSING').padEnd(11)} ${String(s.added).padStart(9)}`,
  );
}
console.log('-------------------------------------------------');
console.log(`${'TOTAL unique'.padEnd(26)} ${''.padEnd(11)} ${String(list.length).padStart(9)}`);
console.log(`\nwrote ${OUT}  (${(bytes / 1024).toFixed(0)} KB)`);
console.log(`multiword entries: ${list.filter((w) => w.includes(' ')).length}`);
