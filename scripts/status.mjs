#!/usr/bin/env node
/**
 * Where the converter stands right now, in one screen.
 *
 *   pnpm build && node scripts/status.mjs [--coverage]
 *
 * ## Why this exists
 *
 * Every session used to open by re-deriving the same numbers with throwaway
 * scripts — and worse, by re-deriving *why* the failures fail, which took seven
 * ad-hoc probes on 2026-07-29 to establish something no file recorded. The
 * README drifted for the same reason: numbers were quoted from memory instead
 * of from a command. Quote this instead.
 *
 * ## What it reports, and why each number is here
 *
 * Both gold sets, because they answer different questions and are NOT
 * comparable: `harvested-inflected.json` is nouns-and-everything and grew from
 * 1,474 to 1,771 forms on 2026-07-28, while `verb-gold.json` is 197 held-out
 * verb forms grouped by ending. A figure without its set named is meaningless.
 *
 * Then the part no other script gives: the guess-tier failures **split by
 * cause**. A form that never segments is missing a STEM — the suffix row is
 * already in the table waiting for it. A form that segments and still loses is
 * missing a RULE, or is being outranked. Those two need completely different
 * work, and the ratio between them is what should pick the next task.
 *
 * Graded in SCRIPT throughout: γ/g and q/k are harmony-selected allographs of
 * one letter, so comparing romanizations invents disagreements. See CLAUDE.md.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);

if (!existsSync(resolve(ROOT, 'dist/index.js'))) {
  console.error('needs a build first: pnpm build');
  process.exit(1);
}

const { analyze } = await load('dist/index.js');
const { toScript } = await load('dist/romanize.js');

const WANT_COVERAGE = process.argv.includes('--coverage');
const pct = (n, d) => (d === 0 ? '   —  ' : `${((100 * n) / d).toFixed(1).padStart(5)}%`);
const bar = (w = 62) => console.log('─'.repeat(w));

/** A gold entry's answer, in script. `verb-gold` stores script directly. */
const wanted = (entry) => {
  if (entry.script !== undefined) return entry.script;
  try {
    return toScript(entry.classical);
  } catch {
    return undefined;
  }
};

const readGold = (path) => {
  const full = resolve(ROOT, path);
  if (!existsSync(full)) return null;
  return JSON.parse(readFileSync(full, 'utf8')).entries;
};

/**
 * Score one gold set, and while doing it record why each failure failed.
 *
 * `neverSegments` is the diagnostic that matters: no candidate peeled a suffix
 * at all, which means no known stem was found under any reading. That is a
 * missing dictionary row, not a missing rule.
 */
function score(entries) {
  const tiers = new Map();
  const groups = new Map();
  const cell = () => ({ n: 0, hit: 0 });
  const bump = (map, key) => {
    if (!map.has(key)) map.set(key, cell());
    return map.get(key);
  };
  let n = 0;
  let hit = 0;
  let neverSegments = 0;
  let segmentsButWrong = 0;

  for (const entry of entries) {
    const want = wanted(entry);
    if (want === undefined) continue;
    const token = analyze(entry.cyrillic)[0];
    const winner = token?.candidates?.[0];
    const tier = winner?.provenance ?? 'none';
    const ok = winner?.script === want;

    n += 1;
    if (ok) hit += 1;
    const t = bump(tiers, tier);
    t.n += 1;
    if (ok) t.hit += 1;
    if (entry.group) {
      const g = bump(groups, entry.group);
      g.n += 1;
      if (ok) g.hit += 1;
    }

    if (!ok && (tier === 'guess' || tier === 'none')) {
      const anySeg = (token?.candidates ?? []).some(
        (c) => (c.segmentation?.suffixes?.length ?? 0) > 0,
      );
      if (anySeg) segmentsButWrong += 1;
      else neverSegments += 1;
    }
  }
  return { n, hit, tiers, groups, neverSegments, segmentsButWrong };
}

/**
 * Every `Provenance` value plus `none`, in tier order.
 *
 * ⚠ `toli` was missing here from the day that tier landed until 2026-08-10,
 * and unlike `eval-model.mjs` — where the same omission threw — this script
 * fails **silently** in two different ways. The gold table simply skips the
 * tier, so its rows summed to 1,839 of 1,884; and `--coverage` dropped 1,186
 * of 28,982 tokens on the floor, printing `REAL DATA 87.3%` where the true
 * figure was 91.4%. A four-point understatement of the metric this script
 * exists to report, with nothing on screen to say a row was missing.
 *
 * Add the tier here when `Provenance` grows, and prefer a shape that throws.
 */
const TIER_ORDER = ['lexicon', 'harvested', 'toli', 'guess', 'none'];

function report(title, path, entries) {
  const r = score(entries);
  console.log(`\n${title}   ${path}`);
  bar();
  console.log(`  ${'tier'.padEnd(14)}${'n'.padStart(7)}${'top-1'.padStart(9)}`);
  for (const tier of TIER_ORDER) {
    const c = r.tiers.get(tier);
    if (c === undefined) continue;
    console.log(`  ${tier.padEnd(14)}${String(c.n).padStart(7)}${pct(c.hit, c.n).padStart(9)}`);
  }
  bar();
  console.log(`  ${'ALL'.padEnd(14)}${String(r.n).padStart(7)}${pct(r.hit, r.n).padStart(9)}`);

  if (r.groups.size > 0) {
    console.log(`\n  ${'by ending'.padEnd(24)}${'n'.padStart(6)}${'top-1'.padStart(9)}`);
    const sorted = [...r.groups].sort((a, b) => b[1].n - a[1].n);
    for (const [name, c] of sorted) {
      console.log(`  ${name.padEnd(24)}${String(c.n).padStart(6)}${pct(c.hit, c.n).padStart(9)}`);
    }
  }

  // The actionable half. These two numbers pick the next task between them.
  const unresolved = r.neverSegments + r.segmentsButWrong;
  if (unresolved > 0) {
    console.log(`\n  why the ${unresolved} guess-tier failures fail:`);
    console.log(
      `    ${String(r.neverSegments).padStart(5)}  never segment — a missing STEM;` +
        ' the suffix row already exists',
    );
    console.log(
      `    ${String(r.segmentsButWrong).padStart(5)}  segment but lose — a missing RULE,` +
        ' or outranked by a bad reading',
    );
  }
  return r;
}

console.log('\n══ gege-converter status ══');
console.log('graded in SCRIPT · the two gold sets are different questions, not comparable');

const noun = readGold('test/fixtures/harvested-inflected.json');
if (noun) report('ALL INFLECTED FORMS', 'test/fixtures/harvested-inflected.json', noun);

const verb = readGold('test/fixtures/verb-gold.json');
if (verb) report('VERBS, held out', 'test/fixtures/verb-gold.json', verb);

// ------------------------------------------------------------------ coverage

/**
 * Coverage is the metric that tracks data progress; top-1 cannot, because each
 * harvest grows the lexicon and the gold set together and the forms it adds are
 * the harder ones. On 2026-07-26 the lexicon nearly doubled, top-1 went 52.5%
 * → 50.9% and coverage 63.8% → 70.1%. Only the second number was real.
 */
if (WANT_COVERAGE) {
  const corpus = resolve(ROOT, '.tmp/harvest-sentences.jsonl');
  if (!existsSync(corpus)) {
    console.log('\n(coverage skipped: .tmp/harvest-sentences.jsonl not present)');
  } else {
    // ⚠ Every tier needs a key here, or the `+= 1` below reads `undefined`,
    // writes NaN, and the token vanishes from the report while still counting
    // toward `tokens` — which is exactly how `toli` went missing and pushed
    // REAL DATA four points under the truth. Built from TIER_ORDER so the two
    // cannot drift apart again.
    const counts = Object.fromEntries(TIER_ORDER.map((tier) => [tier, 0]));
    let tokens = 0;
    for (const line of readFileSync(corpus, 'utf8').split('\n').slice(0, 3000)) {
      if (!line.trim()) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      for (const token of analyze(row.cyrillic ?? '')) {
        if (token.token.kind !== 'word') continue;
        tokens += 1;
        counts[token.candidates[0]?.provenance ?? 'none'] += 1;
      }
    }
    console.log(`\nCOVERAGE over ${tokens} word tokens of running text`);
    bar();
    for (const tier of TIER_ORDER) {
      console.log(
        `  ${tier.padEnd(14)}${String(counts[tier]).padStart(7)}${pct(counts[tier], tokens).padStart(9)}`,
      );
    }
    bar();
    // "Real data" means "not invented by the guesser", so `toli` belongs in it
    // — it is a dictionary, not a rule firing on an unknown string. It is also
    // the least reviewed tier here, so the two figures are printed separately
    // rather than folded: the second is the one to quote when the question is
    // how much of running text a *reviewed* source reaches.
    const real = counts.lexicon + counts.harvested + counts.toli;
    const reviewed = counts.lexicon + counts.harvested;
    console.log(
      `  ${'REAL DATA'.padEnd(14)}${String(real).padStart(7)}${pct(real, tokens).padStart(9)}`,
    );
    console.log(
      `  ${'  of it, not toli'.padEnd(14)}${String(reviewed).padStart(7)}${pct(reviewed, tokens).padStart(9)}`,
    );
  }
} else {
  console.log('\n(run with --coverage for running-text coverage; it reads the sentence harvest)');
}

console.log('');
