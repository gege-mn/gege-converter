import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assemble } from '../src/generate.js';
import { analyze } from '../src/index.js';
import { toScript } from '../src/romanize.js';
import { segment } from '../src/segment.js';

/**
 * End-to-end accuracy against the harvest's own answers for INFLECTED forms.
 *
 * These rows are held out of the lexicon on purpose (see `import-harvest.mjs`), so
 * nothing here can be answered from memory — every hit has to come from
 * segmenting the word, resolving the stem and regenerating the chain. That
 * makes this the only test in the suite that measures the pipeline rather than
 * a single stage.
 *
 * The assertions are regression floors, not targets: set just under the value
 * measured on 2026-07-26, so the suite fails when a change makes the converter
 * worse while leaving room to move the real number. `scripts/eval.mjs` prints
 * the full breakdown.
 */

interface GoldEntry {
  cyrillic: string;
  classical: string;
  /** Tungaamal wrote the suffix after a connector, so the chain is readable. */
  detached: boolean;
}

const fixture = fileURLToPath(new URL('./fixtures/harvested-inflected.json', import.meta.url));
const gold: GoldEntry[] = JSON.parse(readFileSync(fixture, 'utf8')).entries;
const detached = gold.filter((g) => g.detached);
/**
 * The other half, and until 2026-08-10 it was not scored anywhere at all — 273
 * forms sitting at 0.0%, invisible because every assertion here and in
 * `scripts/eval.mjs` filtered to `detached`. 234 of them are the
 * adjective-forming `-тай³` (rulebook §2.3.6), which now has its own row in
 * `data/suffixes.ts`.
 */
const attached = gold.filter((g) => !g.detached);

/**
 * Compare in SCRIPT, never in romanization.
 *
 * γ/g and q/k are allographs of a single letter, selected by vowel harmony, so
 * `ger` and `γer` are the same word and the identical code points. Comparing
 * romanization strings invents disagreements that do not exist — it scored the
 * curated lexicon at 56% when it was really at 83%. Only code points count.
 */
const asScript = (classical: string): string | undefined => {
  try {
    return toScript(classical);
  } catch {
    return undefined;
  }
};
const sameWord = (a: string | undefined, b: string): boolean => {
  if (a === undefined) return false;
  const x = asScript(a);
  return x !== undefined && x === asScript(b);
};

/**
 * The stem of a gold form: everything before the suffix chain. A trailing
 * single a/e is chachlag and belongs to the stem (`qar-a`); the genitive after
 * н is `-u`/`-ü` and does not.
 */
const goldStem = (classical: string): string => {
  const parts = classical.split('-');
  return /^[ae]$/.test(parts[1] ?? '') ? `${parts[0]}-${parts[1]}` : (parts[0] as string);
};

/** Best reading that actually segmented — memorized whole-word hits don't count. */
const bestSegmented = (word: string) =>
  analyze(word)[0]?.candidates.find((c) => c.segmentation.suffixes.length > 0);

describe('inflected forms vs Tungaamal gold', () => {
  it('has a gold set large enough to be meaningful', () => {
    expect(gold.length).toBeGreaterThan(800);
    expect(detached.length).toBeGreaterThan(400);
  });

  it('does not leak inflected forms into the lexicon', async () => {
    const { harvestedLexicon } = await import('../src/data/harvested-lexicon.js');
    const keys = new Set(gold.map((g) => g.cyrillic));
    expect(harvestedLexicon.filter((e) => keys.has(e.cyrillic))).toEqual([]);
  });

  it('reproduces Tungaamal top-1 on the detached gold set', () => {
    const hits = detached.filter((g) =>
      sameWord(bestSegmented(g.cyrillic)?.classical, g.classical),
    );
    // Deliberately slack. This number is NOT comparable across harvests: every
    // harvest grows the lexicon AND the gold set together, and the forms it adds
    // are the harder ones, so top-1 can fall while the converter improves. It
    // did exactly that on 2026-07-26 — the lexicon nearly doubled, this metric
    // moved 52.5% -> 50.9%, and coverage on running text rose 63.8% -> 70.1%.
    // Treat this as a smoke test; `scripts/eval.mjs --coverage` is the real one.
    expect(hits.length / detached.length).toBeGreaterThanOrEqual(0.45);
  });

  /**
   * ⚠ **This half scores 0.0% on purpose, and that is not a bug to fix.**
   *
   * The 273 attached rows all write -тай³ залгаж. A floor of 0.55 stood here
   * for a few hours on 2026-08-10, when the залгаж reading was made the
   * default and this half went 0.0% → 66.7%. The reader then ruled (T1/T2)
   * that joined and detached are *both correct* — *"it's simply a choice. we
   * chose to detach"* — so these rows record the reference converter's house
   * style, not a fact about Mongolian, and matching them is not accuracy.
   *
   * What is asserted instead is the thing that would be a real regression: the
   * залгаж reading must remain **reachable**, because the reader confirms it is
   * correct and only ranking keeps it second. If it stops being built at all,
   * this fails — while conforming to the fixture's style never becomes a
   * target. `test/convert.test.ts` guards the same property per word.
   */
  it('keeps the attached half reachable, without making it the answer', () => {
    const reachable = attached.filter((g) =>
      (analyze(g.cyrillic)[0]?.candidates ?? []).some((c) => sameWord(c.classical, g.classical)),
    );
    expect(reachable.length / attached.length).toBeGreaterThanOrEqual(0.55);
  });

  it('is accurate when the stem is known — over the WHOLE fixture', () => {
    // The split that matters. A known stem converts correctly ~73% of the time;
    // an unknown one is right ~7%. Coverage, not cleverness, is the lever —
    // which is why this floor guards the known-stem path specifically.
    //
    // ⚠ **The denominator moved on 2026-08-10 and so did the floor.** This used
    // to run over `detached` alone with a floor of 0.75. Those are two
    // different measurements and the numbers are not comparable:
    //
    //   known-stem, detached half   78.9% -> 73.6%   (floor was 0.75)
    //   known-stem, whole fixture   66.9% -> 72.7%   (floor now 0.70)
    //
    // Both rows are the same change — the adjective-forming `-тай³` — read
    // against a biased denominator and an unbiased one. The detached half is
    // by construction the half where offering only the дагуулж reading was
    // right, so it *must* fall when the залгаж reading is added; the whole
    // fixture is what says whether the trade was worth making. Scoring only
    // the detached half is what let 273 forms sit at zero unnoticed, so the
    // floor moves to the honest denominator rather than being lowered on the
    // biased one. `scripts/eval.mjs` prints both halves side by side.
    let hit = 0;
    let seen = 0;
    for (const g of gold) {
      const winner = bestSegmented(g.cyrillic);
      if (winner === undefined || winner.provenance === 'guess') continue;
      seen += 1;
      if (sameWord(winner.classical, g.classical)) hit += 1;
    }
    expect(seen).toBeGreaterThan(400);
    expect(hit / seen).toBeGreaterThanOrEqual(0.7);
  });

  it('reaches Tungaamal gold from a perfect stem far more often than from a guess', () => {
    // Oracle: hand the generator the correct stem and let the segmenter and
    // suffix table do the rest. This isolates everything except stem lookup,
    // and it is the ceiling the guesser fails to approach.
    const reachable = detached.filter((g) => {
      const stem = goldStem(g.classical);
      return segment(g.cyrillic).some((s) => sameWord(assemble(stem, s), g.classical));
    });
    expect(reachable.length / detached.length).toBeGreaterThanOrEqual(0.85);
  });
});
