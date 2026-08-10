/**
 * Integrity checks over the data files. These are the guardrail that lets the
 * lexicon be written in romanization: a typo becomes a failing test instead of
 * silently malformed Unicode output.
 */

import { describe, expect, it } from 'vitest';
import { lexicon, lexiconIndex } from '../src/data/lexicon.js';
import { suffixes } from '../src/data/suffixes.js';
import { toScript } from '../src/romanize.js';
import harvestedInflected from './fixtures/harvested-inflected.json' with { type: 'json' };
import verbGold from './fixtures/verb-gold.json' with { type: 'json' };

const MVS = '\u180E';
const NNBSP = '\u202F';

/** Hudum letters, MVS and FVS1-4 — nothing else may appear in generated script. */
const isAllowed = (cp: number): boolean =>
  (cp >= 0x1820 && cp <= 0x1842) ||
  cp === 0x180e ||
  (cp >= 0x180b && cp <= 0x180d) ||
  cp === 0x180f;

describe('lexicon', () => {
  it('is not empty', () => {
    expect(lexicon.length).toBeGreaterThan(100);
  });

  it('romanizes every entry without error', () => {
    for (const entry of lexicon) {
      expect(
        () => toScript(entry.classical),
        `${entry.cyrillic} → ${entry.classical}`,
      ).not.toThrow();
    }
  });

  it('produces only Hudum letters and MVS', () => {
    for (const entry of lexicon) {
      for (const ch of toScript(entry.classical)) {
        const cp = ch.codePointAt(0) ?? -1;
        expect(isAllowed(cp), `${entry.cyrillic} produced U+${cp.toString(16)}`).toBe(true);
      }
    }
  });

  it('never emits NNBSP', () => {
    for (const entry of lexicon) {
      expect(toScript(entry.classical)).not.toContain(NNBSP);
    }
  });

  it('has Cyrillic keys that are lowercase and Cyrillic-only', () => {
    for (const entry of lexicon) {
      expect(entry.cyrillic).toBe(entry.cyrillic.toLowerCase());
      expect(entry.cyrillic).toMatch(/^[а-яёөү]+$/);
    }
  });

  it('gives every entry a gloss and a positive frequency', () => {
    // `gloss` is optional on the type because harvested Tungaamal rows genuinely
    // carry no sense information. It is still mandatory here: a hand-curated
    // entry without a gloss is an entry nobody can review.
    for (const entry of lexicon) {
      expect(entry.gloss, entry.cyrillic).toBeDefined();
      expect(entry.gloss?.length ?? 0, entry.cyrillic).toBeGreaterThan(0);
      expect(entry.freq, entry.cyrillic).toBeGreaterThan(0);
    }
  });

  it('indexes every entry', () => {
    expect([...lexiconIndex.values()].flat()).toHaveLength(lexicon.length);
  });

  it('keeps хар ambiguous, as the motivating example', () => {
    const entries = lexiconIndex.get('хар');
    expect(entries).toHaveLength(2);
    expect(entries?.map((e) => e.classical).sort()).toEqual(['qar-a', 'qara']);
  });
});

describe('suffixes', () => {
  it('romanizes every entry without error', () => {
    for (const suffix of suffixes) {
      expect(() => toScript(suffix.classical), suffix.cyrillic).not.toThrow();
    }
  });

  it('has Cyrillic-only surface forms', () => {
    for (const suffix of suffixes) {
      expect(suffix.cyrillic).toMatch(/^[а-яёөү]+$/);
    }
  });

  it('marks the case suffixes as detached, so they take a connector', () => {
    const cases = suffixes.filter((s) => s.category === 'genitive' || s.category === 'ablative');
    expect(cases.length).toBeGreaterThan(0);
    for (const suffix of cases) expect(suffix.separate, suffix.cyrillic).toBe(true);
  });

  it('writes plural suffixes detached, after a connector', () => {
    const plural = suffixes.filter((s) => s.category === 'plural');
    expect(plural.length).toBeGreaterThan(0);
    for (const suffix of plural) expect(suffix.separate, suffix.cyrillic).toBe(true);
  });

  it('conditions the -ууд plural on what the Classical stem ends in', () => {
    const ud = suffixes.filter((s) => s.cyrillic === 'ууд');
    expect(ud.map((s) => s.after).sort()).toEqual(['consonant', 'vowel']);
  });

  it('never produces a bare MVS on its own', () => {
    for (const suffix of suffixes) {
      expect(toScript(suffix.classical).startsWith(MVS)).toBe(false);
    }
  });
});

/**
 * The held-out verb gold set. It exists because `harvested-inflected.json` has
 * 2 verb-shaped forms in 1,768 and therefore cannot measure verbs at all —
 * see `scripts/build-verb-gold.mjs`.
 *
 * Unlike the other fixtures this one stores `script` rather than romanization,
 * because romanization is not total and two of its forms do not round-trip.
 * That makes these checks load-bearing in a way they are not elsewhere: nothing
 * upstream would catch a malformed target, and a wrong test set is worse than
 * no test set because it silently misdirects every run scored against it.
 */
describe('verb gold set', () => {
  it('agrees with itself wherever it carries a romanization', () => {
    // `classical` is a convenience field. If it disagrees with `script` then one
    // of the two is wrong and we do not know which, so the entry is not usable.
    for (const entry of verbGold.entries) {
      if (!entry.classical) continue;
      expect(toScript(entry.classical), entry.cyrillic).toBe(entry.script);
    }
  });

  it('emits only Hudum letters, MVS and FVS', () => {
    for (const entry of verbGold.entries) {
      for (const ch of entry.script) {
        // A space is legal here and nowhere else in the data files: the
        // reference converter renders some single Cyrillic words as two words
        // (байхгүй is `abu üγei`), which romanization cannot express at all.
        if (ch === ' ') continue;
        expect(isAllowed(ch.codePointAt(0) ?? 0), `${entry.cyrillic}: ${ch}`).toBe(true);
      }
    }
  });

  it('never starts a form with a bare connector', () => {
    for (const entry of verbGold.entries) {
      expect(entry.script.startsWith(MVS), entry.cyrillic).toBe(false);
      expect(entry.script.startsWith(NNBSP), entry.cyrillic).toBe(false);
    }
  });

  it('is held out of the noun gold set, so the two never double-count', () => {
    const nouns = new Set(harvestedInflected.entries.map((e) => e.cyrillic.toLowerCase()));
    const overlap = verbGold.entries.filter((e) => nouns.has(e.cyrillic.toLowerCase()));
    expect(overlap.map((e) => e.cyrillic)).toEqual([]);
  });
});
