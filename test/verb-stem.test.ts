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
import { attestedIndex } from '../src/data/attested-forms.js';
import { analyze, convert, parseVerb, verbStems, verbSuffixes } from '../src/index.js';
import { toScript } from '../src/romanize.js';

/**
 * This file is about how a verb is DERIVED, so the `attested` tier is emptied
 * for it, as it is in `inflected.test.ts` and for the same reason. Its rows
 * are whole words — some of them infinitives, which `verb-stem.ts` reads live
 * as stems — and which words those are changes with every silver set: the corpus
 * has the misspelling учирах, and with that row present учирна has a stem one
 * appended vowel away and the metathesis this file tests is never asked.
 * `test/attested.test.ts` covers the tier's side of that hand-over. Vitest
 * isolates modules per test file, so nothing outside this file sees it.
 */
(attestedIndex as Map<string, readonly string[]>).clear();

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
  // Rulebook 2.2.2/16 separated them by condition instead of by counting, and
  // from then until 2026-10-02 this asserted that every bare -ч row was
  // restricted to a хатуу дэвсгэр. That restriction was on the Classical stem,
  // and it shut out the commonest case: Cyrillic writes ч after р and с
  // whatever the Classical stem ends in, so амьдарч is `amidura` + `ǰu` — a
  // vowel-final stem no `hard` row can take (45 of 48 such forms in the
  // silver read `ǰu`).
  //
  // What separates the converb from the agentive is the **Cyrillic letter in
  // front**, so that is what is asserted now: both stem classes have a row,
  // and the guard is on the surface.
  it('reads bare -ч as the converb after в/г/р/с, and as nothing after any other letter', () => {
    const bareCh = verbSuffixes.filter((r) => r.cyrillic === 'ч');
    expect(new Set(bareCh.map((r) => r.after))).toEqual(new Set(['hard', 'not-hard']));
    for (const row of bareCh) expect(row.kind).toBe('converb-imperfective');

    // хатуу дэвсгэр → ču/čü; anything else → ǰu/ǰü. The Cyrillic is ч in all.
    expect(parseVerb('босч')?.classical).toBe('bosču');
    expect(parseVerb('өгч')?.classical).toBe('ögčü');
    expect(parseVerb('амьдарч')?.classical).toBe('amiduraǰu');
    expect(parseVerb('хүсч')?.classical).toBe('qüseǰü');

    // The agentive follows a vowel, л, м, н — never в/г/р/с on a verb stem.
    // худалч is the one that needs the guard and not merely the stem index:
    // худла- is an attested infinitive, so without it this is `qudalaǰu`.
    expect(verbStems.has('худла')).toBe(true);
    for (const noun of ['худалч', 'хаалгач', 'ажиллаач']) {
      expect(parseVerb(noun), noun).toBeUndefined();
    }
  });

  it('gives a conditioned row the share of its own cell', () => {
    // The four хатуу-дэвсгэр converb rows once carried the ču/čü share of
    // *every* -ж or -ч form (0.02, 0.07, 0.21, 0.17). The ranker multiplies by
    // `share`, so the right reading off a harvested stem scored 0.01 and lost
    // to the guesser: жолоодож came out `ǰoluduǰi`. Nothing structural stops
    // that happening again, so the consequence is what is pinned.
    for (const row of verbSuffixes) {
      if (row.kind !== 'converb-imperfective' || row.after !== 'hard') continue;
      expect(row.share, `${row.cyrillic} → ${row.classical}`).toBeGreaterThan(0.5);
    }
    expect(convert('жолоодож')).toBe(toScript('ǰiluγudču'));
    expect(convert('босч')).toBe(toScript('bosču'));
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

describe('the dictionary tier supplies verb stems too', () => {
  // Until 2026-10-02 only curated and harvested infinitives fed the stem index,
  // which left ~18,000 `toli` infinitives unused: the tier answered аагалах
  // itself and then could not inflect it. 79 of the 91 verb-gold failures were
  // exactly "the suffix row exists and the stem does not".
  it('grows the index by an order of magnitude', () => {
    expect(verbStems.size).toBeGreaterThan(15000);
  });

  it('inflects a verb only the dictionary tier lists', () => {
    const parse = parseVerb('аагалсан');
    expect(parse?.stem.provenance).toBe('toli');
    expect(parse?.classical).toBe('aγalaγsan');
  });

  it('never lets a dictionary stem displace a harvested or curated one', () => {
    // Weakest tier first into the index, so a stronger tier overwrites it.
    expect(verbStems.get('нэрлэ')?.provenance).toBe('harvested');
    expect(verbStems.get('нэрлэ')?.classical).toBe('nerele');
  });

  it('restores the vowel of the better-attested stem first', () => {
    // ахад peels to ах, and two stems complete it: the dictionary's аха- and
    // the harvested ахи- the reader ruled on. Vowel order alone picked аха-.
    expect(verbStems.get('аха')?.provenance).toBe('toli');
    expect(verbStems.get('ахи')?.provenance).toBe('harvested');
    expect(parseVerb('ахад')?.classical).toBe('aqiγad');
  });
});

describe('the soft sign of an и-final verb stem', () => {
  it('reads ярьж and тавьсан off the stems ярих and тавих give', () => {
    expect(parseVerb('ярьж')?.classical).toBe('yariǰu');
    expect(parseVerb('тавьсан')?.classical).toBe('talbiγsan');
    expect(convert('ярьж')).toBe(toScript('yariǰu'));
  });

  it('still requires the и-stem to be attested', () => {
    // морь is a noun; there is no verb мори-, so nothing may be built on it.
    expect(verbStems.has('мори')).toBe(false);
    expect(parseVerb('морьж')).toBeUndefined();
  });
});

/**
 * The stem vowel that moves instead of dropping: нарийвчла + сан is written
 * нарийвчилсан. Like `restoreStemVowel` it proposes and filters — the result
 * is always an attested infinitive stem — and every limit asserted below is a
 * measurement recorded on `restoreMetathesis`, not a taste.
 */
describe('restoreMetathesis', () => {
  const parsed = (word: string) => toScript(parseVerb(word)?.classical ?? '');

  it('recovers a -CCV stem from its -CVC surface', () => {
    expect(parseVerb('нарийвчилсан')?.stem.cyrillic).toBe('нарийвчла');
    expect(parsed('нарийвчилсан')).toBe(toScript('naribčilaγsan'));
    expect(parsed('сурвалжилж')).toBe(toScript('surbulǰilaǰu'));
    expect(parsed('чухалчилж')).toBe(toScript('čiqulačilaǰu'));
    // Across р as well as л, and the vowel that returns need not be the one
    // that left: учир- is учра-.
    expect(parseVerb('учирна')?.stem.cyrillic).toBe('учра');
    expect(parsed('учирна')).toBe(toScript('učaran-a'));
  });

  it('marks the parse as restored', () => {
    expect(parseVerb('нарийвчилсан')?.restored).toBe(true);
  });

  it('only ever returns an attested infinitive', () => {
    for (const word of ['нарийвчилсан', 'сурвалжилж', 'чухалчилж', 'учирна']) {
      const stem = parseVerb(word)?.stem.cyrillic ?? '';
      expect(verbStems.has(stem), word).toBe(true);
    }
    // The shape alone is not enough: no infinitive, no parse.
    expect(parseVerb('зззилсан')).toBeUndefined();
  });

  it('yields to a stem that only needs its vowel appended', () => {
    // тохир- completes both ways — тохиро- and тохро- are both infinitives —
    // and over the silver set the appended stem was the silver's 25 times out
    // of 25 where both existed.
    expect(verbStems.has('тохро')).toBe(true);
    expect(parseVerb('тохирсон')?.stem.cyrillic).toBe('тохиро');
  });

  it('does not take a long vowel for an inserted one', () => {
    // буур- is буура-, not бура- with the у moved: 0 of 75 in the silver set.
    expect(verbStems.has('бура')).toBe(true);
    expect(parseVerb('буурсан')?.stem.cyrillic).toBe('буура');
  });

  it('does not cross х, where the head is an infinitive', () => {
    // хэлэхэд is хэлэх + the dative. хэлхэ- is a real verb, and the perfective
    // row would have made this `qelqiγed`.
    expect(verbStems.has('хэлхэ')).toBe(true);
    expect(parseVerb('хэлэхэд')).toBeUndefined();
  });
});

describe('the evidential past -жээ / -чээ', () => {
  const parsed = (word: string) => toScript(parseVerb(word)?.classical ?? '');

  it('is ǰei after a vowel or a зөөлөн дэвсгэр, čei after a хатуу one', () => {
    expect(parsed('болжээ')).toBe(toScript('bolǰei'));
    expect(parsed('үзүүлжээ')).toBe(toScript('üǰeγülǰei'));
    expect(parsed('шийджээ')).toBe(toScript('siidčei'));
  });

  it('reads the Classical stem, not the Cyrillic letter', () => {
    // -чээ on a vowel-final Classical stem is still ǰei; -жээ on a хатуу
    // дэвсгэр is still čei (шийджээ above).
    expect(parsed('зөвшөөрчээ')).toBe(toScript('ǰöbsiyereǰei'));
    expect(parsed('гарчээ')).toBe(toScript('γarčei'));
  });

  it('does not let a weaker stem stand in for the one that fits the next row', () => {
    // гар- restores to the harvested гара- `γar` and to the dictionary's гари-.
    // The `not-hard` row comes first and гара- does not fit it; taking гари-
    // there instead gave `γariǰei`.
    expect(parseVerb('гарчээ')?.stem.cyrillic).toBe('гара');
  });

  it('writes one form for both harmonies', () => {
    for (const row of verbSuffixes.filter((r) => r.kind === 'evidential')) {
      expect(row.harmony, row.cyrillic).toBeUndefined();
      expect(row.after, row.cyrillic).toBeDefined();
    }
  });
});

describe('the modal converb -н', () => {
  const parsed = (word: string) => toScript(parseVerb(word)?.classical ?? '');

  it('adds NA to a vowel-final stem and links a consonant-final one', () => {
    expect(parsed('үйлдвэрлэн')).toBe(toScript('üiledbürilen'));
    expect(parsed('үзүүлэн')).toBe(toScript('üǰeγülün'));
    expect(convert('үйлдвэрлэн')).toBe(toScript('üiledbürilen'));
  });

  it('follows a vowel, and never й', () => {
    // After й it is the genitive: over the words the row first changed, 8 of
    // 10 were wrong there. жирий- is an attested infinitive, so only the guard
    // keeps this from being read as a converb.
    expect(verbStems.has('жирий')).toBe(true);
    expect(parseVerb('жирийн')).toBeUndefined();
    // And a consonant before it is an abbreviation, not a stem with its vowel
    // dropped: мн is not мо- + н.
    expect(parseVerb('мн')).toBeUndefined();
  });

  it('leaves a noun the dictionary knows alone', () => {
    // Bare -н is how a great many nouns end, and some of them are a verb stem
    // plus н by accident: олон is not оло- + н, дүүрэн and хүрэн are `ng`
    // nouns. All three really do produce a verb parse, so the guard is not
    // vacuous — and all three must lose, because the verb path is consulted
    // only when no curated or harvested reading exists. That ordering is what
    // keeps the collision that reaches the output to 4 words in 174.
    const nouns: Array<[string, string, string]> = [
      ['олон', 'olun', 'olan'],
      ['дүүрэн', 'düγürün', 'düγüreng'],
      ['хүрэн', 'qürün', 'qüreng'],
    ];
    for (const [noun, asVerb, asNoun] of nouns) {
      expect(parseVerb(noun)?.classical, noun).toBe(asVerb);
      expect(convert(noun), noun).toBe(toScript(asNoun));
    }
  });
});

describe('harmony of an ending Cyrillic spells one way', () => {
  it('follows the Classical stem, not the first vowel of the word', () => {
    // нүүрлэ- is feminine in Cyrillic and masculine in Classical (`niγurla`),
    // and -ж does not show which the writer meant. Where the two readings
    // disagree in the silver set, the stem's last vowel is the silver's 9
    // times in 11 and the word's first vowel 2.
    expect(parseVerb('нүүрлэж')?.classical).toBe('niγurlaǰu');
    expect(parseVerb('заналхийлж')?.classical).toBe('ǰanulqileǰü');
  });

  it('still follows the word where the Cyrillic already shows the harmony', () => {
    // -сэн is spelled feminine, so the feminine row is the only candidate.
    expect(parseVerb('нүүрлэсэн')?.suffix.cyrillic).toBe('сэн');
  });
});

describe('an и-final stem after ж, ч, ш', () => {
  it('puts back the и a long-vowel ending absorbed', () => {
    // бичи + ээд is бичээд; peeling `эд` leaves бичэ, which is no stem.
    expect(parseVerb('бичээд')?.stem.cyrillic).toBe('бичи');
    expect(toScript(parseVerb('бичээд')?.classical ?? '')).toBe(toScript('bičiγed'));
    expect(parseVerb('очоод')?.classical).toBe('očiγad');
    expect(parseVerb('уншаад')?.classical).toBe('ungsiγad');
    expect(parseVerb('бичээд')?.restored).toBe(true);
  });

  it('leaves the и alone where Cyrillic writes it', () => {
    expect(parseVerb('яриад')?.restored).toBeFalsy();
  });
});

describe('endings added from the running-text silver set, 2026-10-02', () => {
  const parsed = (word: string) => toScript(parseVerb(word)?.classical ?? '');

  it('reads the perfective converb after a long vowel through its г', () => {
    expect(parsed('суугаад')).toBe(toScript('saγuγad'));
    expect(parsed('тогтоогоод')).toBe(toScript('toγtaγaγad'));
    // After a consonant those letters are a stem that ends in г: хийлгэ- + ээд,
    // not хийл- + гээд.
    expect(parseVerb('хийлгээд')?.stem.cyrillic).toBe('хийлгэ');
  });

  it('writes the conditional `bal`/`bel` however Cyrillic spells it', () => {
    expect(parsed('бодвол')).toBe(toScript('bodubal'));
    expect(parsed('тодруулбал')).toBe(toScript('toduraγulbal'));
    expect(parsed('хэлбэл')).toBe(toScript('kelebel'));
    // The linking vowel after б only, as on the -в past.
    expect(parsed('авбал')).toBe(toScript('abubal'));
  });

  it('writes the completive -чих- flat, in the combinations attested', () => {
    expect(parsed('явчихсан')).toBe(toScript('yabučiqaγsan'));
    // No linking vowel, though `ab` is consonant-final and -сан alone takes one.
    expect(parsed('авчихсан')).toBe(toScript('abčiqaγsan'));
    expect(parsed('гарчихаад')).toBe(toScript('γarčiqaγad'));
    // Not a rule that -чих- may precede anything: an unattested pair is refused.
    expect(parseVerb('явчихтал')).toBeUndefined();
  });

  it('reads the durative converb as the participle plus the instrumental', () => {
    expect(parsed('явсаар')).toBe(toScript('yabuγsaγar'));
    expect(parsed('гарсаар')).toBe(toScript('γaruγsaγar'));
    expect(parsed('үзүүлсээр')).toBe(toScript('üǰeγülüγseγer'));
  });

  it('reads the voluntative with its chachlag', () => {
    expect(parsed('байя')).toBe(toScript('baiy-a'));
    expect(parsed('үзье')).toBe(toScript('üǰey-e'));
    expect(parsed('авъя')).toBe(toScript('abuy-a'));
    // A bare е after a consonant is not this ending — it was `de` and `ne`.
    expect(parseVerb('де')).toBeUndefined();
  });

  it('reads the polite imperative', () => {
    expect(parsed('яваарай')).toBe(toScript('yabuγarai'));
    expect(parsed('болоорой')).toBe(toScript('boluγarai'));
    expect(parsed('үзээрэй')).toBe(toScript('üǰeγerei'));
  });
});

describe('a final -н on a whole word is the word’s own', () => {
  it('reads the modal converb instead of a noun with its н taken off', () => {
    // сал "raft" is a harvested noun, and салан minus a "linking н" is that
    // noun — but nothing follows for the н to link. The verb reading is what
    // the silver writes for all three.
    expect(convert('салан')).toBe(toScript('salun'));
    expect(convert('хууран')).toBe(toScript('qaγurun'));
    expect(convert('өргөжүүлэн')).toBe(toScript('örγeǰiγülün'));
  });

  it('still drops the linking н under a suffix', () => {
    // The reader's ruling this path exists for.
    expect(convert('хэлэнд')).toBe(toScript('kele-dü'));
  });
});

describe('a parse on a real stem outranks an earlier row on a dictionary one', () => {
  it('reads тэнсэн on the harvested тэнсэ-, not on a dictionary тэн- + -сэн', () => {
    // Rows are tried longest ending first, so -сэн met the word before -н did
    // and found a `toli` stem under it. The weak tier may answer only where
    // nothing better reads the word.
    const parse = parseVerb('тэнсэн');
    expect(parse?.stem.provenance).not.toBe('toli');
    expect(parse?.suffix.cyrillic).toBe('н');
    expect(parse?.classical).toBe('tengsen');
  });
});
