/**
 * The `attested` tier: whole words as the silver writes them.
 *
 * Three things are pinned here, and the third is the one that matters. The
 * data is well-formed; the importer's holdouts actually held; and the tier
 * stays in its place — it answers a whole word outright, but as a stem it is
 * the last thing asked, because a row is a statement about one word and the
 * `toli` tier already showed what a weak source does when it is asked early.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { attestedIndex } from '../src/data/attested-forms.js';
import { lexiconIndex } from '../src/data/lexicon.js';
import { analyze, convert, parseVerb } from '../src/index.js';
import { toScript, wordsToScript } from '../src/romanize.js';

const MVS = '\u180E';

/** Hudum letters, MVS and FVS1-4 — nothing else may appear in a row's script. */
const isAllowed = (cp: number): boolean =>
  (cp >= 0x1820 && cp <= 0x1842) ||
  cp === 0x180e ||
  (cp >= 0x180b && cp <= 0x180d) ||
  cp === 0x180f;

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

interface HeldOut {
  cyrillic: string;
  classical: string;
  freq: number;
}
const heldOut: HeldOut[] = JSON.parse(
  readFileSync(here('./fixtures/attested-heldout.json'), 'utf8'),
).entries;

/**
 * The tier as mutable, for the tests that probe its placement with one row.
 *
 * ⚠ The word a test puts IN the tier is named only as the first argument of
 * `withRow` / `withoutRow`, and reaches the check as its parameter. The
 * importer withholds every Cyrillic word a test's code mentions, as a
 * specification — but a row a test injects specifies nothing about that word,
 * and the gate knows to skip exactly this argument. Written out a second time
 * inside the check, эмэгтэй (50,947 occurrences) was withheld from the shipped
 * tier for the sake of a test about эмэгтэйгээ.
 */
const live = attestedIndex as Map<string, readonly string[]>;
const swapRow = (
  cyrillic: string,
  readings: readonly string[] | undefined,
  check: (word: string) => void,
) => {
  const before = live.get(cyrillic);
  if (readings === undefined) live.delete(cyrillic);
  else live.set(cyrillic, readings);
  try {
    check(cyrillic);
  } finally {
    if (before === undefined) live.delete(cyrillic);
    else live.set(cyrillic, before);
  }
};
const withRow = (cyrillic: string, classical: string, check: (word: string) => void) =>
  swapRow(cyrillic, [classical], check);
const withoutRow = (cyrillic: string, check: (word: string) => void) =>
  swapRow(cyrillic, undefined, check);

describe('attested rows are well-formed', () => {
  it('is a real tier, not a stub', () => {
    expect(attestedIndex.size).toBeGreaterThan(1000);
  });

  it('has lowercase Cyrillic keys', () => {
    for (const cyrillic of attestedIndex.keys()) expect(cyrillic).toMatch(/^[а-яёөү]+$/);
  });

  it('romanizes every row to Hudum letters, MVS and selectors only', () => {
    const bad: string[] = [];
    for (const [cyrillic, readings] of attestedIndex) {
      for (const classical of readings) {
        // A row is one Cyrillic word; its reading may be two bichig words
        // (юмуу is `yum uu`), each of which must stand on its own.
        for (const word of classical.split(' ')) {
          const script = toScript(word);
          const stray = [...script].find((ch) => !isAllowed(ch.codePointAt(0) ?? -1));
          if (script.length === 0 || stray !== undefined) bad.push(`${cyrillic}: ${classical}`);
          if (script.startsWith(MVS) || script.endsWith(MVS)) bad.push(`${cyrillic}: edge MVS`);
        }
      }
    }
    // Collected and asserted once: an `expect` per code point over this many
    // rows is most of a minute.
    expect(bad).toEqual([]);
  });

  it('holds two-word readings, for words the two orthographies cut differently', () => {
    const split = [...attestedIndex].filter(([, readings]) => readings[0]?.includes(' '));
    expect(split.length).toBeGreaterThan(100);
    // The reader's own example: "there's no such word … so maybe follow them."
    expect(attestedIndex.get('юмуу')?.[0]).toBe('yum uu');
    expect(convert('юмуу')).toBe(`${toScript('yum')} ${toScript('uu')}`);
  });
});

describe('the holdouts held', () => {
  // A holdout filter that has never rejected anything is not known to work, so
  // each of these is checked against the shipped file rather than trusted to
  // the importer's own ledger.
  it('never repeats a curated word', () => {
    for (const cyrillic of attestedIndex.keys()) {
      expect(lexiconIndex.has(cyrillic), cyrillic).toBe(false);
    }
  });

  it('holds no word any test can assert on', () => {
    // A test is a specification, most of them a reader's. Extracted exactly as
    // `scripts/import-attested.mjs` extracts them — comments stripped, then
    // every Cyrillic run left in the code — this file included. Keep the two in
    // step: a gate checked against a different gate checks nothing.
    const assertedWords = (source: string): string[] =>
      [
        ...source
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^[ \t]*\/\/.*$/gm, '')
          .replace(/[ \t]\/\/ .*$/gm, '')
          // A row a test injects is not a word it asserts on — see `swapRow`.
          .replace(/\bwith(?:out)?Row\(\s*'[^']*'/g, '')
          .matchAll(/[а-яөүёА-ЯӨҮЁ]{2,}/g),
      ].map((m) => m[0].toLowerCase());
    const asserted = new Set(
      readdirSync(here('.'))
        .filter((f) => f.endsWith('.test.ts') || f.endsWith('.test.mjs'))
        .flatMap((f) => assertedWords(readFileSync(here(`./${f}`), 'utf8'))),
    );
    expect(asserted.size).toBeGreaterThan(400);
    // The one way a test word gets a row: the silver wrote exactly what a
    // reader said the word should be — a confirmed ruling or a standing todo.
    const rulings = readFileSync(here('./rulings.test.ts'), 'utf8');
    // Both todo spellings — `'word → classical'` and `'word is classical — why'`
    // — and a homograph's second answer after "or".
    const readerAnswers = new Map<string, Set<string>>();
    const answer = (cyrillic: string, classical: string) => {
      try {
        const script = wordsToScript(classical);
        if (/[а-яөүё]/i.test(classical) || !/^(?:[\u1820-\u1842]|[\u180B-\u180F]| )+$/.test(script))
          return;
        readerAnswers.set(cyrillic, (readerAnswers.get(cyrillic) ?? new Set()).add(script));
      } catch {
        // a todo whose text is prose, not a romanization
      }
    };
    for (const m of rulings.matchAll(/same\(\s*'([а-яөүё]+)'\s*,\s*'([^']+)'\s*\)/g)) {
      answer(m[1] as string, m[2] as string);
    }
    for (const todo of rulings.matchAll(/it\.todo\(\s*'([^']+)'/g)) {
      for (const m of (todo[1] as string).matchAll(
        /([а-яөүё]+) (?:→|is|stays) ([^\s,(—]+)(?: \([^)]*\))?(?: or ([^\s,(—]+))?/g,
      )) {
        answer(m[1] as string, m[2] as string);
        if (m[3] !== undefined) answer(m[1] as string, m[3]);
      }
    }
    for (const [cyrillic, readings] of attestedIndex) {
      if (!asserted.has(cyrillic)) continue;
      const allowed = [...(readerAnswers.get(cyrillic) ?? [])];
      expect(allowed, cyrillic).toContain(wordsToScript(readings[0] as string));
    }
  });

  it('holds no word from the held-out sample', () => {
    expect(heldOut.length).toBeGreaterThan(300);
    for (const entry of heldOut) {
      expect(attestedIndex.has(entry.cyrillic), entry.cyrillic).toBe(false);
    }
  });
});

describe('the tier answers a word and is never peeled from first', () => {
  it('wins a whole word outright', () => {
    // A row that exists only because the derivation disagreed must be the
    // answer, or it was stored for nothing.
    for (const [cyrillic, readings] of [...attestedIndex].slice(0, 200)) {
      const top = analyze(cyrillic)[0]?.candidates[0];
      expect(top?.provenance, cyrillic).toBe('attested');
      expect(top?.script, cyrillic).toBe(wordsToScript(readings[0] as string));
    }
  });

  it('does not capture a longer word the way a weak stem would', () => {
    // хэлэн is the row that broke the `toli` tier: listed as a headword, it
    // took хэлэнд to `qeleng-dü` and the reader's `kele-dü` was never built.
    // An attested хэлэн is asked last, so the ruling survives it.
    withRow('хэлэн', 'qeleng', () => {
      expect(convert('хэлэнд')).toBe(toScript('kele-dü'));
    });
  });

  it('does not hold the verb gate shut as a stem', () => {
    // яваа is an inflected word; pressed into service as a stem it offers
    // яваа + dative for яваад. The converb is a reader's ruling and must win.
    withRow('яваа', 'yabuγ-a', () => {
      expect(convert('яваад')).toBe(toScript('yabuγad'));
    });
  });

  it('serves as a stem only where nothing better exists', () => {
    // A word no tier knows, attested whole: its dative is that plus the suffix,
    // not a guess that ignores what we were told about the stem.
    withoutRow('галсандорж', () => {
      expect(analyze('галсандоржид')[0]?.candidates[0]?.provenance).toBe('guess');
    });
    withRow('галсандорж', 'γalsangdorǰi', () => {
      const top = analyze('галсандоржид')[0]?.candidates[0];
      expect(top?.provenance).toBe('attested');
      expect(top?.classical).toBe('γalsangdorǰi-du');
    });
  });

  it('keeps a row whose spelling one of our own readings shares', () => {
    // The importer stores OUR reading when it has the silver's letters but
    // was losing the ranking. Collapsed as a duplicate of its derived twin on
    // raw prior, such a row vanished and the wrong reading won anyway.
    withRow('аавыгаа', 'abu-yi-ban', (word) => {
      const top = analyze(word)[0]?.candidates[0];
      expect(top?.provenance).toBe('attested');
      expect(top?.classical).toBe('abu-yi-ban');
    });
  });

  it('is the stem before a linking г, ahead of a shorter stem and a stacked suffix', () => {
    // эмэгтэйгээ is эмэгтэй + г + ээ. Read as эмэг + -тэйгээ it is "with one's
    // grandmother", on a real stem with one suffix, and it used to win.
    withRow('эмэгтэй', 'emeγtei', () => {
      expect(convert('эмэгтэйгээ')).toBe(toScript('emeγtei-ben'));
    });
  });

  it('hands an attested infinitive over as a verb stem', () => {
    // An infinitive is its stem plus -х, so a row for one inflects the verb.
    // The stem is read live, which is what lets the importer switch it off.
    withRow('зохиомжлох', 'ǰokiyamǰilaqu', () => {
      const parse = parseVerb('зохиомжлосон');
      expect(parse?.stem.provenance).toBe('attested');
      expect(parse?.classical).toBe('ǰokiyamǰilaγsan');
    });
    withoutRow('зохиомжлох', () => {
      expect(parseVerb('зохиомжлосон')).toBeUndefined();
    });
  });
});

describe('held-out words — what the import does for a word it never saw', () => {
  /**
   * Compared as letters: an MVS against a fused suffix is house style, ruled
   * so by a reader on 2026-08-10, and the importer itself treats such a pair as
   * agreement. Selectors are kept — they are spelling.
   */
  const letters = (script: string) => script.replaceAll(MVS, '');

  it('agrees with the silver on a clear majority of unseen words', () => {
    let hit = 0;
    let hitTokens = 0;
    let tokens = 0;
    for (const entry of heldOut) {
      tokens += entry.freq;
      if (letters(convert(entry.cyrillic)) !== letters(wordsToScript(entry.classical))) continue;
      hit += 1;
      hitTokens += entry.freq;
    }
    // Regression floors, not targets — each set under the value measured when
    // the tier landed (59.4% by type, 79.0% by token);
    // `scripts/eval-heldout.mjs` prints the real numbers.
    //
    // Two, because the sample is drawn by TYPE from a 200,000-word list and is
    // therefore mostly rare words: a third of it is words the guesser has to
    // invent. By token — how often each held-out word occurs in text — the
    // same sample is the commoner words, and that is the figure a reader of
    // running text would feel.
    expect(hit / heldOut.length).toBeGreaterThanOrEqual(0.5);
    expect(hitTokens / tokens).toBeGreaterThanOrEqual(0.7);
  });
});
