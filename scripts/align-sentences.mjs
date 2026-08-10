#!/usr/bin/env node
/**
 * Word-align the 4,000 parallel sentences and emit the word pairs the word-level
 * harvest never saw.
 *
 * ## Why this exists
 *
 * `.tmp/harvest-harvest.jsonl` was built from a **lemma dictionary** — the seed
 * word list is Wiktionary + MonWN + UniMorph headwords. Lemma lists contain
 * verbs only as infinitives, so the harvest has 1,941 `-х` infinitives and
 * almost no inflected verb forms. That is the whole reason verbs are the
 * pipeline's categorical hole: there was never any training signal for them.
 *
 * `.tmp/harvest-sentences.jsonl` is **running text**, and running text is full
 * of inflected verbs. It was collected for homograph/context-shift detection
 * and never mined for word pairs. This script does that.
 *
 * ## What changed on 2026-08-10
 *
 * The first version aligned **positionally** and used the harvest as a check:
 * equal token counts, then every anchorable token must agree, one disagreement
 * condemns the sentence. It kept 1,153 of 4,000 sentences and produced 2,037
 * pairs; 2,188 sentences failed on token count alone.
 *
 * This version uses the harvest as an alignment **constraint** instead — the
 * anchors are fixed points and the short spans between them are what gets
 * solved. The aligner is `scripts/lib/align.mjs`; read its header for how and
 * why. Nothing here tests token counts for equality, because a merge plus a
 * split in the same sentence leaves them equal.
 *
 * ## The footgun this script must not repeat
 *
 * The `unicode` field is gege-linter's **encoding** repair only.
 * `normalizeOrthography` is a separate pass and skipping it is what trained a
 * model that reproduced all three of the bichig reader's rulings wrongly on
 * 2026-07-27. Every script value here goes through it — including the anchor
 * comparison, or the anchors would reject correct rows for the wrong reason.
 *
 *   node scripts/align-sentences.mjs [out.jsonl] [--no-loo] [--sample N]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fromScript } from '@gege-mn/mongol-bichig';
import {
  createAligner,
  KIND,
  normalizeOrthography,
  pairOf,
  splitTailsFrom,
  tokenise,
  trim,
  unknownRun,
} from './lib/align.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const VALUE_FLAGS = new Set(['--sample']);
const consumed = new Set();
argv.forEach((a, i) => {
  if (VALUE_FLAGS.has(a)) consumed.add(i + 1);
});
const positional = argv.filter((a, i) => !a.startsWith('--') && !consumed.has(i));
const OUT = positional[0] ?? '.tmp/aligned-words.jsonl';
const SENTENCES = '.tmp/harvest-sentences.jsonl';
const HARVEST = '.tmp/harvest-harvest.jsonl';
const GOLD = 'test/fixtures/harvested-inflected.json';
const VERB_GOLD = 'test/fixtures/verb-gold.json';
const RULINGS = 'test/rulings.test.ts';

if (!existsSync(`${ROOT}dist/orthography.js`)) {
  console.error('needs a build first: pnpm build');
  process.exit(1);
}
for (const f of [SENTENCES, HARVEST]) {
  if (!existsSync(f)) {
    console.error(`missing ${f} — run the harvest first`);
    process.exit(1);
  }
}

const readJsonl = (file) => {
  const out = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!trim(line)) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // a torn line is not worth failing the run over
    }
  }
  return out;
};

// ------------------------------------------------------------------- oracle

const harvest = readJsonl(HARVEST);

/** Cyrillic → normalised script, from the word-level harvest. */
const oracle = new Map();
for (const r of harvest) {
  if (r.cyrillic && r.unicode) oracle.set(r.cyrillic, normalizeOrthography(r.unicode));
}
const lookup = (k) => oracle.get(k);

const { align } = createAligner({ splittable: splitTailsFrom(harvest) });
const sentences = readJsonl(SENTENCES).map(tokenise);

// ---------------------------------------------------------------------- run

const stats = {
  sentences: sentences.length,
  contributed: 0,
  forced: 0,
  unforced: 0,
  byKind: [0, 0, 0],
};

/** Cyrillic → candidate scripts, for forms the word harvest does not have. */
const votes = new Map();

for (const sent of sentences) {
  const assigned = align(sent, lookup);
  let any = false;
  for (let t = 0; t < sent.keys.length; t += 1) {
    const a = assigned[t];
    if (!a) {
      stats.unforced += 1;
      continue;
    }
    stats.forced += 1;
    if (a.i !== t) continue; // a merge is recorded once, on its first token
    const pair = pairOf(sent, a);
    if (!pair || oracle.has(pair.cyrillic)) continue;
    stats.byKind[pair.kind] += 1;
    if (!votes.has(pair.cyrillic)) votes.set(pair.cyrillic, new Map());
    const v = votes.get(pair.cyrillic);
    v.set(pair.script, (v.get(pair.script) ?? 0) + 1);
    any = true;
  }
  if (any) stats.contributed += 1;
}

/**
 * One Cyrillic form, one target. Where sentences disagree the majority wins;
 * an exact tie is dropped, because a tie means the aligner has no reason to
 * prefer either and a training target has to be a single string.
 */
let disagreed = 0;
let tied = 0;
const found = new Map();
for (const [ck, v] of votes) {
  if (v.size > 1) disagreed += 1;
  const ranked = [...v].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
    tied += 1;
    continue;
  }
  found.set(ck, ranked[0][0]);
}

const rows = [...found]
  .map(([cyrillic, script]) => ({ cyrillic, script, source: 'sentence-aligned' }))
  .sort((a, b) => a.cyrillic.localeCompare(b.cyrillic, 'mn'));

// -------------------------------------------------------------- leak check

/**
 * The held-out set, built exactly as `scripts/export-training-data.mjs` builds
 * it: gold + verb gold + every Cyrillic run of two or more characters anywhere
 * in the rulings file. That last rule is what caught хийж leaking last time.
 *
 * This file is deliberately **not** filtered by it. `scripts/build-verb-gold.mjs`
 * carves `verb-gold.json` out of this very output, so removing the gold here
 * would make the fixture unregenerable — the export is where the filter
 * belongs, and it already applies it. What is asserted here is that the
 * export's filter is *sufficient*: every held-out form present in this file is
 * present under the same lowercased Cyrillic surface key the export removes on,
 * so nothing can slip past it under a different spelling of the same key.
 */
const readJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
const heldOut = new Set([
  ...(readJson(GOLD)?.entries ?? []).map((e) => e.cyrillic.toLowerCase()),
  ...(readJson(VERB_GOLD)?.entries ?? []).map((e) => e.cyrillic.toLowerCase()),
  ...(existsSync(RULINGS)
    ? (readFileSync(RULINGS, 'utf8').match(/[а-яөүёА-ЯӨҮЁ]{2,}/g) ?? []).map((s) => s.toLowerCase())
    : []),
]);
const collisions = rows.filter((r) => heldOut.has(r.cyrillic));
const afterExportFilter = rows.filter((r) => !heldOut.has(r.cyrillic));
const leakOk =
  afterExportFilter.length === rows.length - collisions.length &&
  !afterExportFilter.some((r) => heldOut.has(r.cyrillic)) &&
  rows.every((r) => r.cyrillic === r.cyrillic.toLowerCase());
if (!leakOk) {
  console.error('LEAK: a held-out key would survive the export filter');
  process.exit(1);
}

writeFileSync(OUT, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);

// ------------------------------------------------ leave-one-out precision

/**
 * Hide one anchor at a time and ask the aligner what it would have said.
 *
 * This is the number that decides whether the output is usable at all: the
 * pairs become training targets, and a misaligned pair is a plausible-looking
 * wrong answer, which is the worst kind. Precision is counted over anchors the
 * aligner *produced an answer for* — one it declined to align is a recall loss,
 * not an error.
 *
 * Two caveats travel with it. It measures words the harvest already knows,
 * which are commoner than the forms this script exists to find. And a single
 * hidden anchor sits among neighbours that are still anchors, which is an
 * easier problem than a long unknown span — so it is also bucketed by the
 * length of the unknown run the token lands in, which is the condition the
 * emitted pairs are actually in.
 */
function leaveOneOut() {
  const bucket = () => ({ produced: 0, correct: 0 });
  const overall = bucket();
  const byRun = new Map();
  const byKind = [bucket(), bucket(), bucket()];
  const wrong = [];
  for (const sent of sentences) {
    const { keys, scr } = sent;
    for (let t = 0; t < keys.length; t += 1) {
      const k = keys[t];
      if (!k || !oracle.has(k)) continue;
      const truth = oracle.get(k);
      const hidden = (q) => (q === k ? undefined : oracle.get(q));
      const a = align(sent, hidden)[t];
      if (!a || a.i !== t || a.dc !== 1) continue; // no single-token answer offered
      const got = a.ds === 2 ? `${scr[a.j]} ${scr[a.j + 1]}` : scr[a.j];
      const run = Math.min(unknownRun(keys, t, hidden), 5);
      if (!byRun.has(run)) byRun.set(run, bucket());
      const ok = got === truth;
      for (const b of [overall, byRun.get(run), byKind[a.kind]]) {
        b.produced += 1;
        if (ok) b.correct += 1;
      }
      if (!ok && wrong.length < 200) wrong.push({ cyrillic: k, run });
    }
  }
  return { overall, byRun, byKind, wrong };
}

const loo = flag('--no-loo') ? null : leaveOneOut();

// ------------------------------------------------------------------ report

const pct = (n, d) => `${((100 * n) / (d || 1)).toFixed(1)}%`;
const pad = (n) => String(n).padStart(6);
const tokens = stats.forced + stats.unforced;

console.log(`sentences                  ${pad(stats.sentences)}`);
console.log(
  `  contributed a new pair   ${pad(stats.contributed)}  ${pct(stats.contributed, stats.sentences)}`,
);
console.log('');
console.log(`Cyrillic tokens            ${pad(tokens)}`);
console.log(`  alignment forced         ${pad(stats.forced)}  ${pct(stats.forced, tokens)}`);
console.log(`  left unaligned           ${pad(stats.unforced)}  ${pct(stats.unforced, tokens)}`);
console.log('');
console.log('new pairs by operation');
console.log(`  1:1                      ${pad(stats.byKind[KIND.MATCH])}`);
console.log(`  merge  2 cyr : 1 script  ${pad(stats.byKind[KIND.MERGE])}`);
console.log(`  split  1 cyr : 2 script  ${pad(stats.byKind[KIND.SPLIT])}`);
console.log('');
console.log(
  `forms read two ways        ${pad(disagreed)}  (majority wins, ${tied} exact ties dropped)`,
);
console.log(
  `held-out forms in output   ${pad(collisions.length)}  (export-training-data.mjs removes them)`,
);
console.log('leak assertion             PASS');

if (loo) {
  console.log('');
  console.log(
    `leave-one-out on held-out anchors   ${loo.overall.correct}/${loo.overall.produced}  ${pct(loo.overall.correct, loo.overall.produced)}`,
  );
  console.log('  by length of the unknown run the token lands in');
  for (const run of [...loo.byRun.keys()].sort((a, b) => a - b)) {
    const b = loo.byRun.get(run);
    console.log(
      `    ${run === 5 ? '5+' : `${run} `}  ${String(b.produced).padStart(6)}  ${pct(b.correct, b.produced)}`,
    );
  }
  console.log('  by operation');
  for (const [name, kind] of [
    ['1:1  ', KIND.MATCH],
    ['split', KIND.SPLIT],
  ]) {
    const b = loo.byKind[kind];
    console.log(`    ${name}  ${String(b.produced).padStart(6)}  ${pct(b.correct, b.produced)}`);
  }
}

console.log(`\nnew word pairs: ${rows.length} → ${OUT}`);

// --------------------------------------------------------------- sampling

/**
 * A stratified sample for the reader, as `cyrillic → romanization`.
 * Romanization, never bichig: terminal output cannot be used to judge bichig
 * and CLAUDE.md forbids pasting it anywhere it would be read there.
 */
const sampleN = Number(opt('--sample', 0));
if (sampleN > 0) {
  const groups = [
    ['-ж / -ч imperfective converb', /(ж|ч)$/],
    ['-аад / -ээд perfective converb', /(аад|ээд|оод|өөд)$/],
    ['-сан / -сэн past participle', /(сан|сэн|сон|сөн)$/],
    ['-даг / -дэг habitual', /(даг|дэг|дог|дөг)$/],
    ['-на / -нэ present', /(на|нэ|но|нө)$/],
    ['-лаа / -лээ past', /(лаа|лээ|лоо|лөө)$/],
    ['everything else', /./],
  ];
  // `fromScript` passes a galig letter through as itself, which would put a
  // bichig literal into terminal output — the one place it cannot be judged.
  // Anything left in the Mongolian block becomes its code point instead.
  const escapeScript = (s) =>
    s.replace(/[\u1800-\u18AF]/g, (c) => `<U+${c.codePointAt(0).toString(16).toUpperCase()}>`);
  const rom = (s) => {
    try {
      return escapeScript(fromScript(s));
    } catch {
      return `[unromanizable: ${[...s].map((c) => c.codePointAt(0).toString(16)).join(' ')}]`;
    }
  };
  const taken = new Set();
  const per = Math.max(1, Math.round(sampleN / groups.length));
  console.log('\n--- stratified sample ------------------------------------------');
  for (const [label, re] of groups) {
    // A merged key ends in the particle, not in a verb ending: `рок ч` is not a
    // converb. Multi-word keys only ever belong to the last bucket.
    const pool = rows.filter(
      (r) =>
        !taken.has(r.cyrillic) &&
        re.test(r.cyrillic) &&
        (label === 'everything else' || !r.cyrillic.includes(' ')),
    );
    const step = Math.max(1, Math.floor(pool.length / per));
    const picked = [];
    for (let i = 0; i < pool.length && picked.length < per; i += step) picked.push(pool[i]);
    if (picked.length === 0) continue;
    console.log(`\n${label}`);
    for (const r of picked) {
      taken.add(r.cyrillic);
      console.log(`  ${r.cyrillic}  →  ${rom(r.script)}`);
    }
  }
}
