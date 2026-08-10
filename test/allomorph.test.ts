/**
 * Allomorph selection driven by the **Classical** stem.
 *
 * Several suffixes choose their form from the shape of the stem's last
 * letter, which the Cyrillic surface form hides: Cyrillic хот ends in a
 * consonant but Classical `qota` does not, so хотын is `qota-yin`. The pairs
 * below are the "Use after" column of gege-linter `docs/suffixes.md`; each
 * case is tested on both sides of its condition.
 */

import { describe, expect, it } from 'vitest';
import { suffixes } from '../src/data/suffixes.js';
import { allomorphFits } from '../src/generate.js';
import { analyze, convert } from '../src/index.js';
import { finalLetter, toScript } from '../src/romanize.js';

/** Best Classical reading of one Cyrillic word. */
const best = (word: string): string | undefined => analyze(word)[0]?.candidates[0]?.classical;

describe('genitive — yin after a vowel, un/ün after a consonant, u/ü after н', () => {
  it('takes yin after a vowel-final Classical stem', () => {
    // Cyrillic хот is consonant-final; Classical qota is not. This is the
    // whole reason the condition cannot be checked while segmenting.
    expect(best('хотын')).toBe('qota-yin');
    expect(best('тэнгэрийн')).toBe('tngri-yin');
    // The claim here is `-yin` after a vowel-final stem. The stem's ш was a
    // constant that rode along, and moved on 2026-08-04 when the reader ruled
    // багш is ᠪᠠᠭᠰᠢ — see docs/rulings.md. The allomorph is untouched.
    expect(best('багшийн')).toBe('baγsi-yin');
  });

  it('takes un/ün after a consonant-final Classical stem', () => {
    expect(best('малын')).toBe('mal-un');
    expect(best('монголын')).toBe('mongγul-un');
    expect(best('гэрийн')).toBe('ger-ün');
  });

  it('takes the masculine un even when Cyrillic spells the suffix -ийн', () => {
    // Cyrillic writes -ийн rather than -ын after г, ш, ь, й and и, so the
    // surface form alone cannot pick between un and ün.
    expect(best('цагийн')).toBe('čaγ-un');
  });

  it('takes the short u after an н-final Classical stem', () => {
    expect(best('хааны')).toBe('qaγan-u');
  });
});

describe('accusative — yi after a vowel, i after a consonant', () => {
  it('takes yi after a vowel-final Classical stem', () => {
    expect(best('хотыг')).toBe('qota-yi');
  });

  it('takes i after a consonant-final Classical stem', () => {
    expect(best('гэрийг')).toBe('ger-i');
    expect(best('цагийг')).toBe('čaγ-i');
  });
});

describe('instrumental — bar/ber after a vowel, iyar/iyer after a consonant', () => {
  it('takes bar after a vowel-final Classical stem', () => {
    expect(best('хотоор')).toBe('qota-bar');
    expect(best('ааваар')).toBe('abu-bar');
  });

  it('takes iyar/iyer after a consonant-final Classical stem', () => {
    expect(best('гэрээр')).toBe('ger-iyer');
    expect(best('малаар')).toBe('mal-iyar');
  });
});

describe('reflexive — ban/ben after a vowel, iyan/iyen after a consonant', () => {
  it('takes ban after a vowel-final Classical stem', () => {
    expect(best('хотоо')).toBe('qota-ban');
  });

  it('takes iyan/iyen after a consonant-final Classical stem', () => {
    expect(best('гэрээ')).toBe('ger-iyen');
    expect(best('малаа')).toBe('mal-iyan');
  });

  it('reads the preceding suffix, not the stem, when it stacks on a case', () => {
    // задлаг хэлбэр: гэр + tü + ben. tü ends in a vowel, so ban/ben wins
    // over iyan/iyen even though the stem itself ends in a consonant.
    expect(best('гэртээ')).toBe('ger-tü-ben');
  });
});

describe('dative-locative — d-forms after vowels and soft finals, t-forms after hard', () => {
  it('takes du/dü after a vowel or a soft final (н, м, л, нг)', () => {
    expect(best('хотод')).toBe('qota-du');
    expect(best('номд')).toBe('nom-du');
  });

  it('takes tu/tü after the hard finals б, г, р, с, д', () => {
    // Cyrillic writes -д here, so the t-form can only come from the
    // Classical stem: ulus ends in с, čaγ in г, arad in д.
    expect(best('улсад')).toBe('ulus-tu');
    expect(best('цагт')).toBe('čaγ-tu');
    expect(best('гэрт')).toBe('ger-tü');
    expect(best('бичигт')).toBe('bičig-tü');
  });

  it('is not conditioned on voicing — с is voiceless and д voiced, both hard', () => {
    expect(best('улсад')).toBe('ulus-tu');
    expect(best('ардад')).toBe('arad-tu');
    // …while м and л are voiced too but soft, so they take the d-form.
    expect(best('номд')).toBe('nom-du');
    expect(best('ажилд')).toBe('aǰil-du');
  });
});

describe('script output', () => {
  it('still joins with MVS and never NNBSP', () => {
    expect(convert('хотын')).toBe(toScript('qota-yin'));
    expect(convert('хотын')).toContain('\u180E');
    expect(convert('хотын')).not.toContain('\u202F');
  });
});

describe('finalLetter', () => {
  it('reports the last Hudum letter of a romanized form', () => {
    expect(finalLetter('qota')).toBe(0x1820); // A
    expect(finalLetter('ger')).toBe(0x1837); // RA
    expect(finalLetter('ulus')).toBe(0x1830); // SA
  });

  it('looks past a connector, so a chachlag stem still ends in its vowel', () => {
    expect(finalLetter('qar-a')).toBe(0x1820); // A, not MVS
  });

  it('returns undefined for nothing to measure', () => {
    expect(finalLetter('')).toBeUndefined();
    expect(finalLetter('-')).toBeUndefined();
    expect(finalLetter('щ')).toBeUndefined(); // does not romanize
  });
});

describe('allomorphFits', () => {
  it('accepts everything when a suffix states no condition', () => {
    expect(allomorphFits(undefined, 'qota')).toBe(true);
  });

  it('separates vowels from consonants', () => {
    expect(allomorphFits('vowel', 'qota')).toBe(true);
    expect(allomorphFits('vowel', 'ger')).toBe(false);
    expect(allomorphFits('consonant', 'ger')).toBe(true);
    expect(allomorphFits('consonant', 'qota')).toBe(false);
  });

  it('treats н as its own class', () => {
    expect(allomorphFits('n', 'qaγan')).toBe(true);
    expect(allomorphFits('consonant-not-n', 'qaγan')).toBe(false);
    expect(allomorphFits('consonant-not-n', 'ger')).toBe(true);
  });

  it('knows the hard finals б г р с д, and only those', () => {
    for (const stem of ['ab', 'čaγ', 'ger', 'ulus', 'arad']) {
      expect(allomorphFits('hard', stem), stem).toBe(true);
      expect(allomorphFits('not-hard', stem), stem).toBe(false);
    }
    for (const stem of ['qota', 'qaγan', 'nom', 'aǰil', 'čeng']) {
      expect(allomorphFits('hard', stem), stem).toBe(false);
      expect(allomorphFits('not-hard', stem), stem).toBe(true);
    }
  });

  it('keeps a reading it cannot classify rather than dropping it', () => {
    // Losing a candidate is worse than keeping an unlikely one; ranking sorts
    // it out either way.
    expect(allomorphFits('vowel', '')).toBe(true);
  });
});

describe('the suffix table', () => {
  it('offers both allomorphs of every conditioned pair, so no stem is left with none', () => {
    const conditioned = suffixes.filter((s) => s.after !== undefined);
    expect(conditioned.length).toBeGreaterThan(0);

    // Grouped by category + harmony, NOT by Cyrillic surface. Some surfaces are
    // inherently one-sided: the contracted forms (анги + аар → ангиар) exist
    // only after a vowel-final stem, because a consonant-final stem writes the
    // uncontracted аар instead. Requiring both conditions per surface would
    // forbid them. What must still hold is that the category as a whole covers
    // every stem shape, so no stem is left with no reading at all.
    const groups = new Map<string, Set<string>>();
    for (const suffix of conditioned) {
      const key = `${suffix.category}/${suffix.harmony ?? 'any'}`;
      const seen = groups.get(key) ?? new Set<string>();
      seen.add(suffix.after ?? '');
      groups.set(key, seen);
    }

    // The vowel/consonant pairs and the dative hard/not-hard pair must each
    // be complete. (Genitive is deliberately three-way and split across two
    // Cyrillic surfaces, so it is checked by the conversion tests above.)
    for (const [key, conditions] of groups) {
      if (key.startsWith('instrumental/') || key.startsWith('reflexive/')) {
        expect([...conditions].sort(), key).toEqual(['consonant', 'vowel']);
      }
      if (key.startsWith('dative-locative/')) {
        expect([...conditions].sort(), key).toEqual(['hard', 'not-hard']);
      }
    }
  });

  it('conditions no suffix on a stem shape the checker cannot express', () => {
    const known = new Set(['vowel', 'consonant', 'consonant-not-n', 'n', 'hard', 'not-hard']);
    for (const suffix of suffixes) {
      if (suffix.after !== undefined) expect(known.has(suffix.after), suffix.cyrillic).toBe(true);
    }
  });
});

describe('chachlag stems keep their connector', () => {
  const MVS = '\u180E';
  const countMvs = (s: string) => [...s].filter((c) => c === MVS).length;

  it('харууд is qar-a + nuγud — хар-а нугуд, two connectors', () => {
    expect(best('харууд')).toBe('qar-a-nuγud');
    expect(countMvs(convert('харууд'))).toBe(2);
  });

  it('never selects the consonant-final plural for a chachlag stem', () => {
    // qar-a ends in a vowel, so `ud` is not available to it at all. This is
    // what keeps the form well-formed — not rewriting the stem.
    expect(best('харууд')).not.toBe('qaraud');
    expect(allomorphFits('consonant', 'qar-a')).toBe(false);
    expect(allomorphFits('vowel', 'qar-a')).toBe(true);
  });

  it('picks the plural allomorph by what the Classical stem ends in', () => {
    expect(best('хотууд')).toBe('qota-nuγud'); // qota — vowel-final
    expect(best('номууд')).toBe('nom-ud'); // nom  — consonant-final
    expect(best('гэрүүд')).toBe('ger-üd'); // ger  — consonant-final
  });

  it('leaves the stem untouched when nothing follows', () => {
    expect(convert('хар')).toBe(toScript('qar-a'));
    expect(countMvs(convert('хар'))).toBe(1);
  });

  it('never leaves a connector at the very end of a word', () => {
    for (const w of ['хар', 'харууд', 'харын', 'хотууд', 'бороо', 'долоо']) {
      expect(convert(w).endsWith(MVS), w).toBe(false);
    }
  });
});
