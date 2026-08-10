/**
 * Imported bichig → this project's orthography.
 *
 * The byte sequences here are real harvested output, already run through
 * gege-linter's `applyFixes`. Expected forms were supplied by a bichig reader
 * on 2026-07-26.
 */

import { describe, expect, it } from 'vitest';
import {
  attachDetachedSuffix,
  dropGlideYa,
  foldNonInitialO,
  normalizeOrthography,
  repairDevoicedGa,
} from '../src/orthography.js';
import { toScript } from '../src/romanize.js';

const cps = (s: string): number[] => [...s].map((c) => c.codePointAt(0) ?? -1);

describe('dropGlideYa', () => {
  it('reproduces the reader-supplied байгууллага exactly', () => {
    // Tungaamal gave ᠪᠠᠶᠢᠭᠤᠯᠤᠯᠭ<MVS>ᠠ; the correct form has a single I, no YA glide.
    const imported = 'ᠪᠠᠶᠢᠭᠤᠯᠤᠯᠭ\u180Eᠠ';
    const expected = 'ᠪᠠᠢᠭᠤᠯᠤᠯᠭ\u180Eᠠ';
    expect(cps(dropGlideYa(imported))).toEqual(cps(expected));
  });

  it('turns sayin into sain', () => {
    // SA A YA I NA -> SA A I NA
    expect(cps(dropGlideYa('ᠰᠠᠶᠢᠨ'))).toEqual([0x1830, 0x1820, 0x1822, 0x1828]);
  });

  it('leaves the genitive suffix ᠶᠢᠨ alone', () => {
    // ᠬᠣᠲᠠ<MVS>ᠶᠢᠨ — the YA+I here is the suffix, not a glide. Stripping it
    // would produce ᠬᠣᠲᠠ<MVS>ᠢᠨ, which is not a word.
    const genitive = 'ᠬᠣᠲᠠ\u180Eᠶᠢᠨ';
    expect(cps(dropGlideYa(genitive))).toEqual(cps(genitive));
  });

  it('leaves the accusative suffix ᠶᠢ alone', () => {
    const accusative = 'ᠬᠣᠲᠠ\u180Eᠶᠢ';
    expect(cps(dropGlideYa(accusative))).toEqual(cps(accusative));
  });

  it('leaves a YA that is not before I', () => {
    // ᠪᠠᠶᠠᠷ bayar — real intervocalic y, a consonant.
    const bayar = 'ᠪᠠᠶᠠᠷ';
    expect(cps(dropGlideYa(bayar))).toEqual(cps(bayar));
  });

  it('leaves a word-initial YA+I, which has no preceding vowel', () => {
    const yisu = 'ᠶᠢᠰᠦ';
    expect(cps(dropGlideYa(yisu))).toEqual(cps(yisu));
  });
});

describe('foldNonInitialO', () => {
  it('rewrites the second-syllable o of ᠮᠣᠩᠭᠣᠯ', () => {
    const imported = 'ᠮᠣᠩᠭᠣᠯ';
    expect(cps(foldNonInitialO(imported))).toEqual([
      0x182e, 0x1823, 0x1829, 0x182d, 0x1824, 0x182f,
    ]);
  });

  it('keeps a first-syllable o', () => {
    // ᠬᠣᠲᠠ qota — the o is in the first syllable and stays.
    const qota = 'ᠬᠣᠲᠠ';
    expect(cps(foldNonInitialO(qota))).toEqual(cps(qota));
  });

  it('folds ö to ü past the first syllable', () => {
    // ᠥᠳᠥᠷ -> ᠥᠳᠦᠷ
    expect(cps(foldNonInitialO('ᠥᠳᠥᠷ'))).toEqual([0x1825, 0x1833, 0x1826, 0x1837]);
  });

  it('leaves loanwords alone via the galig test', () => {
    // ᠹᠣᠲᠣ foto — FA (U+1839) is galig, so the word is foreign and keeps its o.
    const foto = 'ᠹᠣᠲᠣ';
    expect(cps(foldNonInitialO(foto))).toEqual(cps(foto));
  });
});

describe('normalizeOrthography', () => {
  it('applies both rules in one pass', () => {
    // A constructed word carrying both problems: a glide YA+I and a later o.
    const input = 'ᠪᠠᠶᠢᠭᠣᠯ';
    expect(cps(normalizeOrthography(input))).toEqual([
      0x182a, 0x1820, 0x1822, 0x182d, 0x1824, 0x182f,
    ]);
  });

  it('is idempotent', () => {
    const input = 'ᠪᠠᠶᠢᠭᠣᠯ';
    const once = normalizeOrthography(input);
    expect(cps(normalizeOrthography(once))).toEqual(cps(once));
  });
});

describe('foldNonInitialO and long vowels', () => {
  it('leaves ᠭᠣᠣᠯ alone — the doubled o is one first syllable', () => {
    // The documented exception. Folding per code point would give ᠭᠣᠤᠯ,
    // which is not a word.
    const gool = 'ᠭᠣᠣᠯ';
    expect(cps(foldNonInitialO(gool))).toEqual(cps(gool));
  });

  it('folds a doubled o that IS past the first syllable, as a unit', () => {
    // ᠲᠣᠭᠣᠣ — first o is syllable one; the ᠣᠣ after ᠭ is a later long vowel
    // and both halves fold together.
    expect(cps(foldNonInitialO('ᠲᠣᠭᠣᠣ'))).toEqual([0x1832, 0x1823, 0x182d, 0x1824, 0x1824]);
  });

  it('folds ö to ü in өвөө', () => {
    expect(cps(foldNonInitialO('ᠥᠪᠥᠭᠡ'))).toEqual([0x1825, 0x182a, 0x1826, 0x182d, 0x1821]);
  });

  it('leaves a doubled ö in the first syllable alone', () => {
    const oe = 'ᠥᠥᠷ';
    expect(cps(foldNonInitialO(oe))).toEqual(cps(oe));
  });
});

/**
 * A case suffix written as a free-standing word, re-attached with MVS.
 *
 * Every input below is a real harvested byte sequence. The expectations are
 * `toScript` output, so the rule is graded against what the pipeline itself
 * generates rather than against a form typed here — the same discipline
 * `test/data.test.ts` applies to the data files.
 *
 * Ruled by a bichig reader on 2026-07-27, on a converted article: "it made
 * errors with -у -ү suffixes for some reason, it's just mvs + у (or ү)".
 */
describe('attachDetachedSuffix', () => {
  const SP = ' ';
  const FVS1 = String.fromCodePoint(0x180b);
  /** ᠬᠠᠭᠠᠨ, the stem Tungaamal writes before a detached genitive. */
  const QAGAN = String.fromCodePoint(0x182c, 0x1820, 0x182d, 0x1820, 0x1828);

  it('attaches the detached masculine genitive, dropping the isolate FVS', () => {
    // ᠬᠠᠭᠠᠨ<SPACE>ᠤ<FVS1> — how all 389 harvested -ы genitives are written.
    const detached = QAGAN + SP + String.fromCodePoint(0x1824) + FVS1;
    expect(cps(attachDetachedSuffix(detached))).toEqual(cps(toScript('qaγan-u')));
  });

  it('attaches the detached feminine genitive', () => {
    const detached = QAGAN + SP + String.fromCodePoint(0x1826) + FVS1;
    expect(cps(attachDetachedSuffix(detached))).toEqual(cps(toScript('qaγan-ü')));
  });

  it('attaches the detached accusative — the largest group, 1,042 rows', () => {
    const ulus = String.fromCodePoint(0x1824, 0x182f, 0x1824, 0x1830);
    const detached = ulus + SP + String.fromCodePoint(0x1822) + FVS1;
    expect(cps(attachDetachedSuffix(detached))).toEqual(cps(toScript('ulus-i')));
  });

  it('attaches a stack of two, right to left', () => {
    // ᠥᠪᠡᠷᠰᠡᠳ<SPACE>ᠢ<FVS1><SPACE>ᠪᠡᠨ — stem + accusative + reflexive, the shape
    // the reader corrected өөрсдийгөө to.
    const stem = String.fromCodePoint(0x1825, 0x182a, 0x1821, 0x1837, 0x1830, 0x1821, 0x1833);
    const detached =
      stem +
      SP +
      String.fromCodePoint(0x1822) +
      FVS1 +
      SP +
      String.fromCodePoint(0x182a, 0x1821, 0x1828);
    expect(cps(attachDetachedSuffix(detached))).toEqual(cps(toScript('öbersed-i-ben')));
  });

  it('leaves ᠦᠭᠡᠢ alone — it is a word, not a suffix', () => {
    // 619 harvested rows end in it, and attaching it would fuse эрхгүй into one
    // word. The fold stops at anything absent from the suffix registry.
    const erqe = String.fromCodePoint(0x1821, 0x1837, 0x182c, 0x1821);
    const ugei = String.fromCodePoint(0x1826, 0x182d, 0x1821, 0x1822);
    const phrase = erqe + SP + ugei;
    expect(cps(attachDetachedSuffix(phrase))).toEqual(cps(phrase));
  });

  it('attaches a suffix that follows ᠦᠭᠡᠢ, without swallowing ᠦᠭᠡᠢ itself', () => {
    // ангигүйгээ: angi + ügei + ben. The reflexive attaches to ügei; the space
    // before ügei stays a space.
    const angi = String.fromCodePoint(0x1820, 0x1829, 0x1822);
    const ugei = String.fromCodePoint(0x1826, 0x182d, 0x1821, 0x1822);
    const ben = String.fromCodePoint(0x182a, 0x1821, 0x1828);
    const got = attachDetachedSuffix(angi + SP + ugei + SP + ben);
    expect(cps(got)).toEqual(cps(angi + SP + ugei + String.fromCodePoint(0x180e) + ben));
  });

  it('leaves a genuine compound alone', () => {
    // ᠳᠠᠢᠪᠠᠷ ᠦᠭᠡ (дайвар үг) — two words, neither a case particle.
    const phrase =
      String.fromCodePoint(0x1833, 0x1820, 0x1822, 0x182a, 0x1820, 0x1837) +
      SP +
      String.fromCodePoint(0x1826, 0x182d, 0x1821);
    expect(cps(attachDetachedSuffix(phrase))).toEqual(cps(phrase));
  });

  it('never consumes the whole string, leaving no stem', () => {
    const bare = String.fromCodePoint(0x1824) + FVS1;
    expect(cps(attachDetachedSuffix(bare))).toEqual(cps(bare));
  });

  it('is idempotent', () => {
    const detached = QAGAN + SP + String.fromCodePoint(0x1824) + FVS1;
    const once = attachDetachedSuffix(detached);
    expect(cps(attachDetachedSuffix(once))).toEqual(cps(once));
  });

  it('runs inside normalizeOrthography', () => {
    const detached = QAGAN + SP + String.fromCodePoint(0x1824) + FVS1;
    expect(cps(normalizeOrthography(detached))).toEqual(cps(toScript('qaγan-u')));
  });
});

describe('repairDevoicedGa', () => {
  // Ruled 2026-07-29, six words including both controls: the harvest's ХА
  // after с/ш/т/д where the Cyrillic has г is simply wrong, and салгах —
  // which the harvest already wrote with ГА after л — confirmed that the
  // apparent rule was not merely too narrow.
  const repaired = (cyrillic: string, classical: string) =>
    repairDevoicedGa(cyrillic, toScript(classical));

  it('rewrites ХА to ГА after с/д where the Cyrillic has г', () => {
    expect(repaired('асгах', 'asqaqu')).toBe(toScript('asγaqu'));
    expect(repaired('батга', 'badq-a')).toBe(toScript('badγ-a'));
    expect(repaired('дасгал', 'dasqal')).toBe(toScript('dasγal'));
  });

  it('leaves ХА alone where the Cyrillic really has х', () => {
    // This is why the rule cannot be script-only: nothing in ᠠᠮᠤᠰᠬᠢ
    // distinguishes it from ᠠᠰᠬᠠᠬᠤ. A blanket rewrite fixes 221 rows and
    // breaks these 16.
    expect(repaired('амсхий', 'amusqi')).toBe(toScript('amusqi'));
    expect(repaired('зайлсхий', 'ǰailasqi')).toBe(toScript('ǰailasqi'));
  });

  it('leaves a word carrying BOTH clusters untouched', () => {
    // Conservative by design: the Cyrillic cluster's position is not aligned
    // to the Classical letter's, so a word with both сг and сх is ambiguous
    // and is left whole rather than half-repaired.
    const both = toScript('asqaqu');
    expect(repairDevoicedGa('асгасхий', both)).toBe(both);
  });

  it('does not touch the infinitive -qu, which follows a vowel', () => {
    // The rewrite is anchored to a preceding с/ш/т/д, so the ХА of the -х
    // infinitive is out of reach even in a word the rule fires on.
    expect(repaired('асгах', 'asqaqu')).toBe(toScript('asγaqu'));
  });
});
