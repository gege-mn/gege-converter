import { describe, expect, it } from 'vitest';
import { harmonyOf } from '../src/chars.js';
import { segment } from '../src/segment.js';
import { guessStem, resolveStem } from '../src/stem.js';

describe('harmonyOf', () => {
  it('classifies by the first non-neutral vowel', () => {
    expect(harmonyOf('хот')).toBe('masculine');
    expect(harmonyOf('гэр')).toBe('feminine');
  });

  it('reports и-only words as neutral', () => {
    expect(harmonyOf('бичиг')).toBe('neutral');
  });
});

describe('segment', () => {
  it('always offers the whole word as a stem first', () => {
    expect(segment('хот')[0]).toEqual({ stem: 'хот', suffixes: [] });
  });

  it('peels a dative suffix', () => {
    const parses = segment('хотод');
    const dative = parses.find((p) => p.stem === 'хот');
    expect(dative?.suffixes.map((s) => s.category)).toEqual(['dative-locative']);
  });

  it('respects vowel harmony when choosing an allomorph', () => {
    // хот is masculine, so only the masculine -du attaches, never -dü.
    const forms = segment('хотод')
      .filter((p) => p.stem === 'хот')
      .flatMap((p) => p.suffixes.map((s) => s.classical));
    expect(forms).toContain('du');
    expect(forms).not.toContain('dü');
  });

  it('refuses to peel down to a stub', () => {
    for (const parse of segment('хотод')) expect(parse.stem.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps ambiguity rather than resolving it', () => {
    expect(segment('хотод').length).toBeGreaterThan(1);
  });
});

describe('resolveStem', () => {
  it('returns every lexicon reading of an ambiguous stem', () => {
    expect(resolveStem('хар')).toHaveLength(2);
  });

  it('marks lexicon hits as such', () => {
    expect(resolveStem('хот')[0]?.provenance).toBe('lexicon');
  });

  it('falls back to a guess, flagged, for unknown stems', () => {
    const match = resolveStem('зззнн');
    expect(match[0]?.provenance).toBe('guess');
  });
});

describe('guessStem', () => {
  it('collapses Cyrillic long vowels', () => {
    expect(guessStem('уул')).toBe('ul');
  });

  it('harmonises г and х', () => {
    expect(guessStem('гэр')).toBe('ger');
    expect(guessStem('гал')).toBe('γal');
  });

  it('writes a native з as ᠵ, the same letter as ж', () => {
    // ᠽ is the galig letter and belongs to loanwords only. Of the 726 native
    // rows with з and no ж, 695 spell it `ǰ` and not one spells it `z`. This
    // assertion previously read `γazar`, documenting the gap as if it were a
    // limitation the guesser could not close — it could.
    expect(guessStem('газар')).toBe('γaǰar');
    expect(guessStem('зун')).toBe('ǰun');
  });

  it('writes н before г or х as ᠩ, but not before other consonants', () => {
    // 249/253 for нг and 93/97 for нх; every other following consonant is
    // between 10% and 83%, so the rule stops at the two velars.
    expect(guessStem('хонгор')).toBe('qongγur');
    // The attested form is `angq-a`; the guesser closes the syllable with the
    // harmony vowel instead of a chachlag, which is the separate approximation
    // below. What matters here is the ᠩ.
    expect(guessStem('анх')).toBe('angqu');
    // нч is 22% — даанч stays lexical rather than being swept in on a
    // plausible-sounding generalisation.
    expect(guessStem('даанч')).toBe('danči');
  });

  it('is approximate on purpose — this is why guesses rank low', () => {
    // дурлал is `duralal`: Classical keeps vowels between the consonants that
    // Cyrillic dropped. Nothing in the surface form says where they go, so the
    // guesser cannot recover them and returns a shorter word.
    expect(guessStem('дурлал')).toBe('durlal');
  });

  it('never ends a word on a bare ᠬ/ᠴ/ᠵ/ᠱ', () => {
    // No native word is spelled that way — of the 2,460 harvested rows ending
    // in Cyrillic х/ц/ч/ж/ш, the only 10 with a bare final consonant are
    // loanwords and letter names. The vowel is harmony-selected for х and ц.
    expect(guessStem('тэгэх')).toBe('tegekü');
    expect(guessStem('яах')).toBe('yaqu');
    expect(guessStem('гээч')).toBe('geči');
    expect(guessStem('гэлц')).toBe('gelče');
    expect(guessStem('хааш')).toBe('qasi');
  });

  it('writes a native ц as ᠴ, the same letter as ч', () => {
    // ᠼ is the foreign-word letter; 581 of 598 native rows with a ц use ᠴ.
    expect(guessStem('арц')).toBe('arča');
    expect(guessStem('сацуу')).toBe('saču');
  });
});
