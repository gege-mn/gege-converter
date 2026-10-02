#!/usr/bin/env node
/**
 * Raw silver data → the two files every importer reads.
 *
 *   node scripts/standardize-silver.mjs \
 *     --words RAW.jsonl [--words …] \
 *     [--context RAW-SENTENCES.jsonl …] [--sentences RAW-SENTENCES.jsonl …] \
 *     [--freq FREQ.tsv[.gz]] [--out-dir .tmp]
 *
 *   .tmp/harvest-harvest.jsonl    {cyrillic, unicode, freq, source, alt?, repair}
 *   .tmp/harvest-sentences.jsonl  {cyrillic, unicode, repair}
 *
 * A raw row is `{cyrillic, raw}`: a Cyrillic word or sentence and what the
 * silver wrote for it, untouched — Tungaamal text. This script
 * is the one place that text is turned into Unicode, with `tungaamalToUnicode`,
 * and every row it writes says so (`repair: 'tungaamal'`) so that
 * `scripts/lib/silver.mjs` picks the matching orthography pass. The ENCODING
 * is repaired here; orthography is each importer's own pass. (An in-context
 * form comes back from the aligner already in this project's orthography.
 * That pass is idempotent, so the importers running it again changes nothing
 * — but it means `unicode` is not uniformly "encoding only".)
 *
 * It talks to nothing. Fetching is not this repo's business (docs/harvest.md);
 * raw files and everything written here stay under `.tmp/`.
 *
 * ## A word's answer in context outranks its answer alone
 *
 * The silver writes about 4% of running words differently inside a sentence
 * than alone, and where the two differ an independent silver set sides with the
 * in-context form about two to one. So `--context` sentences are aligned word
 * for word, and a form seen in at least two sentences with a clear majority
 * replaces the isolated answer. Three artifacts of the alignment are refused,
 * each found the hard way — see `contextForm` below.
 *
 * ⚠ `--context` and `--sentences` are separate on purpose. A sentence set kept
 * for scoring (`scripts/eval-*.mjs`) must never be passed as `--context`, or
 * the words it is scored on have been read from it.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));
const WORDS = all('--words');
const CONTEXT = all('--context');
const SENTENCES = all('--sentences');
const FREQ = all('--freq')[0];
const OUT_DIR = resolve(ROOT, all('--out-dir')[0] ?? '.tmp');

if (WORDS.length === 0) {
  console.error(
    'usage: standardize-silver.mjs --words RAW.jsonl [--context S.jsonl] [--sentences S.jsonl] [--freq F.tsv]',
  );
  process.exit(1);
}
if (!existsSync(resolve(ROOT, 'dist/tungaamal.js'))) {
  console.error('needs a build first: pnpm build');
  process.exit(1);
}

const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { tungaamalToUnicode } = await load('dist/tungaamal.js');
const { normalizeConverted } = await load('dist/orthography.js');
const A = await load('scripts/lib/align.mjs');

const REPAIR = 'tungaamal';

function readJsonl(file) {
  const rows = [];
  for (const line of readFileSync(resolve(ROOT, file), 'utf8').split('\n')) {
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      // a torn line is not worth failing the run over
    }
  }
  return rows;
}

/** cyrillic → raw answer. A later file wins, so list the better source last. */
function rawOf(files) {
  const raw = new Map();
  for (const f of files)
    for (const r of readJsonl(f)) if (r.raw !== undefined) raw.set(r.cyrillic, r.raw);
  return raw;
}

const freq = new Map();
if (FREQ !== undefined) {
  const bytes = readFileSync(resolve(ROOT, FREQ));
  const text = (FREQ.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8');
  for (const line of text.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab > 0) freq.set(line.slice(0, tab), Number(line.slice(tab + 1).split('\t')[0]));
  }
}

// ------------------------------------------------------------ context forms

/** Hudum letters only — what two spellings are compared by. */
const lettersOnly = (script) => script.replace(/[^\u1820-\u1842]/g, '');
const UGEI = '\u1826\u182D\u1821\u1822';

/**
 * The registry joins the clitics ni / mini / čini with MVS and the pipeline
 * writes them as words of their own. Left joined, every "word нь" would align
 * as a 2:1 merge and cost the word its 1:1 context, so for the alignment — and
 * only there — the three are put back after a space.
 */
const CLITIC =
  /\u180E(\u1828\u1822|\u182E\u1822\u1828\u1822|\u1834\u1822\u1828\u1822)(?![\u1820-\u1842]|[\u180B-\u180F])/g;
const EDGES = /^[^\u1820-\u1842]+|(?:(?![\u1820-\u1842]|[\u180B-\u180D\u180F]).)+$/gsu;
const SCRIPT_WORD = /^(?:[\u1820-\u1842]|[\u180B-\u180F])+$/;
const CYRILLIC_WORD = /^[^а-яёөүА-ЯЁӨҮ]*[а-яёөүА-ЯЁӨҮ]+[^а-яёөүА-ЯЁӨҮ0-9A-Za-z-]*$/;

const words = rawOf(WORDS);

/** cyrillic → [[form, sentences], …], commonest first, from clean 1:1 units only. */
function contextForms() {
  const forms = new Map();
  if (CONTEXT.length === 0) return forms;
  const oracle = new Map(
    [...words].map(([cyrillic, raw]) => [cyrillic, normalizeConverted(tungaamalToUnicode(raw))]),
  );
  const silverRows = [...oracle].map(([cyrillic, unicode]) => ({ cyrillic, unicode }));
  const { align } = A.createAligner({ splittable: A.splitTailsFrom(silverRows) });
  for (const [cyrillic, raw] of rawOf(CONTEXT)) {
    const tok = A.tokenise({
      cyrillic,
      unicode: tungaamalToUnicode(raw).replace(CLITIC, ' $1'),
      repair: REPAIR,
    });
    const typed = cyrillic.split(/[ \n\r\t]+/).filter(Boolean);
    align(tok, (k) => oracle.get(k)).forEach((a, i) => {
      if (a?.dc !== 1 || a.ds !== 1) return;
      const word = tok.keys[i];
      // The Cyrillic token must be this word and edge punctuation, nothing
      // else: a hyphen, digit or Latin letter inside makes it a fragment.
      const token = typed[i] ?? '';
      if (!word || !CYRILLIC_WORD.test(token) || /[0-9A-Za-z-]/.test(token)) return;
      const form = tok.scr[a.j].replace(EDGES, '');
      if (!SCRIPT_WORD.test(form)) return;
      const seen = forms.get(word) ?? new Map();
      forms.set(word, seen.set(form, (seen.get(form) ?? 0) + 1));
    });
  }
  return new Map([...forms].map(([k, m]) => [k, [...m].sort((x, y) => y[1] - x[1])]));
}

const MIN_CONTEXTS = 2;
const MIN_SHARE = 0.6;

/**
 * The in-context form of a word, if it has earned its place: seen in at least
 * `MIN_CONTEXTS` sentences and holding `MIN_SHARE` of them. Refused when it is
 * one of three things the aligner produces and the silver never wrote:
 *
 * - **truncated** — a word the silver writes as two (X үгүй) paired with
 *   only one of its halves;
 * - **lost negation** — the same with no isolated answer to compare: a -гүй
 *   word whose form does not end in ügei;
 * - **swallowed** — a short particle glued to its neighbour (дээ came back as
 *   `ügei-de`): a form far longer than the isolated answer is the neighbour
 *   riding along.
 *
 * A one-letter word (ч, л) is always such a particle and never takes a
 * context form at all.
 */
function contextForm(cyrillic, alone, forms) {
  if (forms === undefined || cyrillic.length <= 1) return undefined;
  const total = forms.reduce((sum, [, n]) => sum + n, 0);
  const [top, n] = forms[0];
  if (n < MIN_CONTEXTS || n / total < MIN_SHARE) return undefined;
  const truncated =
    alone?.includes(' ') === true &&
    alone.split(' ').some((part) => lettersOnly(part) === lettersOnly(top));
  const lostNegation =
    alone === undefined && cyrillic.endsWith('гүй') && !lettersOnly(top).endsWith(UGEI);
  const swallowed =
    alone !== undefined && lettersOnly(top).length > 1.6 * lettersOnly(alone).length + 1;
  if (truncated || lostNegation || swallowed) return undefined;
  const second = forms[1];
  const alt = second && second[1] >= 2 && second[1] / total >= 0.25 ? second[0] : undefined;
  return { form: top, alt };
}

// --------------------------------------------------------------------- emit

const context = contextForms();
const stats = { isolated: words.size, fromContext: 0, contextOnly: 0, overrides: 0 };
const out = [];
for (const cyrillic of new Set([...words.keys(), ...context.keys()])) {
  const alone = words.has(cyrillic) ? tungaamalToUnicode(words.get(cyrillic)) : undefined;
  const inContext = contextForm(cyrillic, alone, context.get(cyrillic));
  if (inContext !== undefined) {
    stats.fromContext += 1;
    if (alone === undefined) stats.contextOnly += 1;
    // Compared in one orthography, or every о the isolated answer has not had
    // folded yet would count as the context disagreeing with it.
    else if (normalizeConverted(alone) !== inContext.form) stats.overrides += 1;
  }
  const unicode = inContext?.form ?? alone;
  if (unicode === undefined) continue;
  out.push(
    JSON.stringify({
      cyrillic,
      unicode,
      freq: freq.get(cyrillic) ?? 0,
      source: inContext === undefined ? 'alone' : 'context',
      ...(inContext?.alt === undefined ? {} : { alt: inContext.alt }),
      repair: REPAIR,
    }),
  );
}
writeFileSync(resolve(OUT_DIR, 'harvest-harvest.jsonl'), `${out.join('\n')}\n`);
console.log(`words: ${out.length}`, JSON.stringify(stats));

if (SENTENCES.length > 0) {
  const sentences = rawOf(SENTENCES);
  writeFileSync(
    resolve(OUT_DIR, 'harvest-sentences.jsonl'),
    `${[...sentences]
      .map(([cyrillic, raw]) =>
        JSON.stringify({ cyrillic, unicode: tungaamalToUnicode(raw), repair: REPAIR }),
      )
      .join('\n')}\n`,
  );
  console.log(`sentences: ${sentences.size}`);
}
