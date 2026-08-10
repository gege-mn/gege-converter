/**
 * Verb stems derived from `-х` infinitives, plus the mined suffix table.
 *
 * The table's Classical column has no upstream authority — the canonical
 * registry is entirely nominal — so these tests pin the *method* as much as the
 * values: stems come from infinitives already in the dictionary, suffixes come
 * from `scripts/mine-verb-suffixes.mjs`, and the verb path is a fallback that
 * must never displace an attested noun reading.
 */

import { describe, expect, it } from 'vitest';
import { analyze, convert, parseVerb, verbStems, verbSuffixes } from '../src/index.js';
import { toScript } from '../src/romanize.js';

describe('verb stems come from the dictionary, not a new table', () => {
  it('derives a useful number of stems', () => {
    expect(verbStems.size).toBeGreaterThan(1500);
  });

  it('strips the infinitive from both alphabets', () => {
    const stem = verbStems.get('нэрлэ');
    expect(stem?.classical).toBe('nerele');
  });

  it('has no stem that still carries its Cyrillic infinitive ending', () => {
    for (const cyrillic of verbStems.keys()) expect(cyrillic.endsWith('х'), cyrillic).toBe(false);
  });

  it('does not assume the Classical stem cannot end in -qu', () => {
    // It can, and exactly one strip is still right: алхах "to step" is
    // `alququ`, whose stem is `alqu-`. Stripping greedily would eat the stem.
    expect(verbStems.get('алха')?.classical).toBe('alqu');
  });
});

describe('every mined suffix row carries its evidence', () => {
  it('records an attestation count and a share', () => {
    for (const row of verbSuffixes) {
      expect(row.attested, row.cyrillic).toBeGreaterThan(0);
      expect(row.share, row.cyrillic).toBeGreaterThan(0);
      expect(row.share, row.cyrillic).toBeLessThanOrEqual(1);
    }
  });

  it('romanizes every Classical form to real script', () => {
    for (const row of verbSuffixes) {
      expect(() => toScript(`bari${row.classical}`), row.classical).not.toThrow();
    }
  });

  // Until 2026-08-03 this asserted `not.toContain('лаа')` on the grounds that
  // the ending is ambiguous — running text says the verbal past `l-a` (68%),
  // the lemma harvest says the deverbal noun plus reflexive `l-iyan` (авралаа,
  // "one's rescue") — and that the segmenter, not a row, had to decide.
  //
  // A bichig reader ruled боллоо `bolul-a` on 2026-08-03 and the rows went in.
  // The ambiguity argument was never wrong; it was an argument for a **low
  // share**, which is what the rows carry, not for absence. What keeps the
  // nominal reading reachable is the ordering in `buildCandidates`: `parseVerb`
  // runs only when no dictionary reading survived, so a word the lexicon knows
  // as a noun is never re-read as a verb. This asserts that, rather than
  // asserting the rows away.
  it('reads -лаа as the past without displacing the nominal reading', () => {
    const past = verbSuffixes.filter((r) => ['лаа', 'лээ', 'лоо', 'лөө'].includes(r.cyrillic));
    expect(past.length).toBe(4);
    for (const row of past) {
      expect(row.kind, row.cyrillic).toBe('tense-past');
      // Unanimous over 17 verbal attestations: a consonant-final Classical stem
      // takes the linking u/ü, a vowel-final one takes nothing.
      expect(row.linking, row.cyrillic).toBe(true);
      expect(row.share, row.cyrillic).toBeLessThanOrEqual(1);
    }
    // The reader's own example, and the shape of the rule: `bol` is
    // consonant-final so the vowel goes in, `bai` is not so it does not.
    expect(parseVerb('боллоо')?.classical).toBe('bolul-a');
    expect(parseVerb('байлаа')?.classical).toBe('bail-a');
    // Still nominal, because the dictionary answers first.
    expect(convert('тавуулаа')).toBe(toScript('tabuγula-ban'));
  });

  // Until 2026-07-31 this asserted `not.toContain('ч')`, because -ч was two
  // suffixes counted as one — the converb and the agentive noun-former — with
  // nothing dominating over 42 forms. That was a statement about the *evidence*,
  // and it was correct: the mining could not separate them.
  //
  // Rulebook 2.2.2/16 separates them by condition instead of by counting, so the
  // rows now exist. What replaces the old assertion is the guard that makes them
  // safe: every bare -ч row is restricted to a хатуу дэвсгэр, and the agentive
  // (-аач⁴, ажиллаач) only ever follows a vowel, so no -ч row can reach it.
  it('admits bare -ч only after a хатуу дэвсгэр, so it cannot swallow the agentive', () => {
    const bareCh = verbSuffixes.filter((r) => r.cyrillic === 'ч');
    expect(bareCh.length).toBeGreaterThan(0);
    for (const row of bareCh) {
      expect(row.after, `${row.cyrillic} → ${row.classical}`).toBe('hard');
      expect(row.kind).toBe('converb-imperfective');
    }
    expect(parseVerb('ажиллаач')).toBeUndefined();
  });

  it('spells the perfective converb short, so the head lands on the stem', () => {
    // Attested 83 times in the sentence alignment as of 2026-07-29, which is
    // what unblocked it: a lemma dictionary cannot contain an inflection, so
    // "zero attestations" was a property of the old source, not the language.
    //
    // The row is `ад`, not `аад`. The stem's own final vowel merges into the
    // long vowel on the surface, so peeling the short form leaves the
    // vowel-final stem the index actually holds.
    const cyrillic = verbSuffixes.map((r) => r.cyrillic);
    for (const short of ['ад', 'од', 'эд', 'өд']) {
      expect(cyrillic, short).toContain(short);
    }
    for (const long of ['аад', 'оод', 'ээд', 'өөд']) {
      expect(cyrillic, long).not.toContain(long);
    }
    expect(parseVerb('аваад')?.stem.cyrillic).toBe('ава');
    expect(parseVerb('болоод')?.stem.cyrillic).toBe('боло');
  });
});

describe('the linking vowel before a consonant-initial verb suffix', () => {
  // 14 of 14 consonant-final aligned attestations take it; 140 of 140
  // vowel-final ones are written flat. See `data/verb-suffixes.ts`.
  // Graded in SCRIPT: γ/g and q/k are harmony-selected allographs of one
  // letter, so `dügürüged` and `düγürüγed` are the same word and the identical
  // code points. Comparing romanizations invents disagreements.
  const parsed = (word: string) => toScript(parseVerb(word)?.classical ?? '');

  it('inserts u/ü when the Classical stem ends in a consonant', () => {
    // ав → `ab`, so аваад is abuγad, not abγad.
    expect(parsed('аваад')).toBe(toScript('abuγad'));
    // дүүрэ → `dügür`, feminine, so the linking vowel is ü.
    expect(parsed('дүүрээд')).toBe(toScript('dügürüged'));
  });

  it('leaves a vowel-final stem flat', () => {
    // ашигла → `asiγla` already ends in a vowel; nothing is inserted.
    expect(parsed('ашиглаад')).toBe(toScript('asiγlaγad'));
  });

  it('applies only to rows the corpus attests it for', () => {
    // судлаж is `sudulǰu`, written flat despite the consonant-final stem, so
    // the imperfective converb is deliberately not marked `linking`.
    expect(parsed('судлаж')).toBe(toScript('sudulǰu'));
  });

  it('gives every linking row an explicit harmony', () => {
    // `joinVerb` reads the vowel off the row — feminine takes ü, anything else
    // takes u — and `harmony` is optional on the type. A `linking` row without
    // one would silently insert the masculine vowel into a feminine word, with
    // nothing in the data to show it had happened.
    for (const row of verbSuffixes) {
      if (!row.linking) continue;
      expect(row.harmony, row.cyrillic).toBeDefined();
    }
  });
});

/**
 * Restoring the stem vowel Cyrillic drops before a consonant-initial ending.
 *
 * The flag matters beyond bookkeeping: `generate.ts` multiplies a restored
 * parse's prior by `RESTORED_DISCOUNT`, so a reading recovered by putting a
 * letter back must never be presented as one that was spelled out.
 */
describe('restoreStemVowel', () => {
  it('marks the parses that only exist because a vowel was put back', () => {
    // хэлэ + нэ is written хэлнэ; peeling leaves хэл, which is no infinitive.
    expect(parseVerb('хэлнэ')?.stem.cyrillic).toBe('хэлэ');
    expect(parseVerb('хэлнэ')?.restored).toBe(true);
    expect(parseVerb('үзнэ')?.restored).toBe(true);
    expect(parseVerb('бичсэн')?.stem.cyrillic).toBe('бичи');
  });

  it('does not mark a stem the word spelled out', () => {
    for (const word of ['аваад', 'ажилладаг', 'нэрлэсэн']) {
      expect(parseVerb(word)?.restored, word).toBeFalsy();
    }
  });

  it('restores nothing when the head already ends in a vowel', () => {
    // ава is a stem as written, so the restore path is never consulted; a head
    // that ends in a vowel has nothing to put back by construction.
    expect(parseVerb('аваад')?.stem.cyrillic).toBe('ава');
  });
});

describe('parseVerb', () => {
  it('takes the longest stem', () => {
    // ажилла- + -даг, never ажил- with the rest swallowed.
    expect(parseVerb('ажилладаг')?.stem.cyrillic).toBe('ажилла');
  });

  it('produces the reader-confirmed past participle', () => {
    expect(parseVerb('нэрлэсэн')?.classical).toBe('nereleγsen');
  });

  it('refuses a word whose stem it does not know', () => {
    expect(parseVerb('зззсэн')).toBeUndefined();
  });

  it('refuses when the stem does not account for the whole head', () => {
    // A leftover is a longer verb we do not know, not licence to drop letters.
    expect(parseVerb('нэрлэxyzсэн')).toBeUndefined();
  });
});

describe('the verb path is a fallback, not a preference', () => {
  it('converts the form a bichig reader supplied', () => {
    // Reader, 2026-07-27: нэр = нэрэ, нэрлэх = нэрэлэхү, сан/сон = гсан.
    expect(convert('нэрлэсэн')).toBe(toScript('nereleγsen'));
  });

  it('leaves an attested noun reading alone', () => {
    // These resolve as whole dictionary entries; the verb path must not fire.
    for (const word of ['хот', 'ном', 'мэргэжил']) {
      const top = analyze(word)[0]?.candidates[0];
      expect(top?.provenance, word).not.toBe('guess');
      expect(top?.segmentation.suffixes.length, word).toBe(0);
    }
  });

  it('still prefers a case reading where one exists', () => {
    const top = analyze('хотод')[0]?.candidates[0];
    expect(top?.classical).toBe('qota-du');
  });

  it('does not let the perfective converb take a word off a dictionary', () => {
    // The `ад/од/эд/өд` rows are two letters long and fire on plenty of nouns:
    // ахад parses as `aqiγad` and мод as `moγad`. Both must lose — one to a
    // case reading, one to a whole-word entry. Unlike хотод above, these two
    // really do produce a verb parse, so the guard is not vacuous.
    expect(parseVerb('ахад')?.classical).toBe('aqiγad');
    // `aq-a-du`, not `aqa-du`: ах took the chachlag on 2026-07-29 when the
    // reader ruled on it. The guard is about which *reading* wins, so the
    // dative stays the expected answer — only its spelling moved.
    expect(analyze('ахад')[0]?.candidates[0]?.classical).toBe('aq-a-du');
    expect(parseVerb('мод')?.classical).toBe('moγad');
    expect(analyze('мод')[0]?.candidates[0]?.classical).toBe('modu');
  });
});
