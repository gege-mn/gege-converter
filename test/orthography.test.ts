/**
 * Orthographic rules confirmed by a bichig reader on 2026-07-26.
 *
 * These encode decisions, not guesses — each one overrode what the seed
 * lexicon originally said, so the tests exist to stop the old forms coming
 * back.
 */

import { describe, expect, it } from 'vitest';
import { lexicon } from '../src/data/lexicon.js';
import { convert } from '../src/index.js';
import { fromScript, toScript } from '../src/romanize.js';
import { guessStem } from '../src/stem.js';

const cps = (s: string): number[] => [...s].map((c) => c.codePointAt(0) ?? -1);
const classicalOf = (cyr: string) => lexicon.find((e) => e.cyrillic === cyr)?.classical;

const VOWELS = 'aeiouöüē';

describe('o and ö are written only in the first syllable', () => {
  it('uses u after the first syllable in masculine words', () => {
    expect(classicalOf('монгол')).toBe('mongγul');
    expect(classicalOf('богино')).toBe('boγuni');
  });

  it('holds across the whole lexicon, except the documented exception', () => {
    const offenders: string[] = [];
    for (const entry of lexicon) {
      let seenVowel = false;
      for (const ch of entry.classical) {
        if (!VOWELS.includes(ch)) continue;
        if (seenVowel && (ch === 'o' || ch === 'ö')) offenders.push(entry.cyrillic);
        seenVowel = true;
      }
    }
    // гол → γool is a genuine lexical exception with a doubled short o.
    //
    // филармони `filarmoni` is a different kind of exception and belongs in a
    // different list: the rule is categorical for *native* words, and a
    // loanword is outside its scope entirely. Reader, 2026-08-10: "foreign
    // word, can have o after first syllable." Adding it here rather than
    // widening the rule keeps the count of native exceptions at one.
    expect([...new Set(offenders)]).toEqual(['гол', 'филармони']);
  });

  it('applies the rule in the guesser too', () => {
    // Unknown word: only the first о stays o, the rest become u.
    expect(guessStem('бологод')).toBe('boluγud');
  });

  it('applies the feminine counterpart in the guesser', () => {
    // ө after the first syllable becomes ü.
    expect(guessStem('өдөр')).toBe('ödür');
  });
});

describe('medial i-diphthongs are V+i, not V+y+i', () => {
  it('drops the YA glide', () => {
    expect(classicalOf('сайн')).toBe('sain');
    expect(classicalOf('сайхан')).toBe('saiqan');
    expect(classicalOf('дайн')).toBe('dain');
    expect(classicalOf('айраг')).toBe('airaγ');
  });

  it('emits no YA (U+1836) in сайн', () => {
    expect(cps(convert('сайн'))).toEqual([0x1830, 0x1820, 0x1822, 0x1828]);
  });

  it('leaves a real intervocalic y alone', () => {
    // bayar/bayan/qoyar have y between two full vowels — a consonant, not a glide.
    expect(classicalOf('баяр')).toBe('bayar');
    expect(classicalOf('хоёр')).toBe('qoyar');
  });
});

describe('free variation selectors', () => {
  it('writes a digit for an FVS and maps it to the right code point', () => {
    expect(cps(toScript('y1'))).toEqual([0x1836, 0x180b]);
    expect(cps(toScript('y2'))).toEqual([0x1836, 0x180c]);
    expect(cps(toScript('y3'))).toEqual([0x1836, 0x180d]);
    // FVS4 is U+180F — U+180E is MVS, a different thing entirely.
    expect(cps(toScript('a4'))).toEqual([0x1820, 0x180f]);
  });

  it('renders найм exactly as Tungaamal screenshot', () => {
    expect(cps(convert('найм'))).toEqual([0x1828, 0x1820, 0x1836, 0x180b, 0x182e, 0x1820]);
  });

  it('round-trips through fromScript', () => {
    expect(fromScript(toScript('nay1ma'))).toBe('nay1ma');
  });

  it('does not count an FVS as the final letter of a stem', () => {
    // найм ends in A (U+1820), not in the selector — allomorph choice depends
    // on this, so a suffix after найм must see a vowel-final stem.
    expect(convert('наймын')).toContain(toScript('nay1ma'));
  });
});
