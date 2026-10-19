#!/usr/bin/env node
/**
 * Rebuild `.tmp/harvest-sentences.jsonl` from `.tmp/parallel-lyrics.txt.gz`.
 *
 * The original 4,000-sentence file was produced by a harvest script that no
 * longer exists, and `eval.mjs --coverage/--sentences`, `status.mjs` and
 * `align-sentences.mjs` all read the path. One entry per lyric line pair is
 * near a sentence in this genre; token counts must agree so the pair is real.
 * Not comparable to the lost file — re-measure, never diff against old numbers.
 *
 *   curl -o .tmp/parallel-lyrics.txt.gz -L \
 *     https://raw.githubusercontent.com/tugstugi/mongolian-nlp/master/bichig2cyrillic/lyrics.txt.gz
 *   node scripts/build-sentence-corpus.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = `${ROOT}.tmp/parallel-lyrics.txt.gz`;
const OUT = `${ROOT}.tmp/harvest-sentences.jsonl`;

if (!existsSync(SRC)) {
  console.error(`missing ${SRC} — see the header for the curl command`);
  process.exit(1);
}

const rows = [];
for (const line of gunzipSync(readFileSync(SRC)).toString('utf8').split('\n')) {
  const bar = line.indexOf('|');
  if (bar < 0) continue;
  const cy = line.slice(0, bar).split(' ').filter(Boolean);
  const bi = line.slice(bar + 1).split(' ').filter(Boolean);
  if (cy.length === 0 || cy.length !== bi.length) continue;
  rows.push({ cyrillic: cy.join(' '), script: bi.join(' ') });
}

writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`${rows.length} line pairs -> ${OUT}`);
