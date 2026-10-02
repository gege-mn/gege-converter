/**
 * Tungaamal → Unicode.
 *
 * The table behind this module was measured against fonts, and the measurement
 * cannot run here — the Tungaamal faces are proprietary and are not in this
 * repository. What can run is the other half: that the shipped code applies
 * the measured table exactly. `fixtures/tungaamal-rules.json` carries one
 * worked example per row, each a pair the measurement proved draws the same
 * written forms, and the faithful mode has to reproduce every one.
 *
 * Everything below that is about the default mode, where the module
 * deliberately does NOT reproduce what the fonts drew, and each test says
 * which reading of the text it is taking instead.
 *
 * Invisible characters are escapes throughout; the helpers spell sequences as
 * code points so a failure prints something a person can read.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tungaamalRules } from '../src/data/tungaamal-rules.js';
import {
  detectTungaamal,
  isTungaamal,
  rewriteTungaamal,
  tungaamalToUnicode,
} from '../src/index.js';
import { toScript } from '../src/romanize.js';

const MVS = '\u180E';
const NNBSP = '\u202F';
const FVS1 = '\u180B';
const FVS2 = '\u180C';
const FVS3 = '\u180D';
const ZWNJ = '\u200C';
/** The two letters the Tungaamal convention adds. */
const KE = 'ᢈ';
const GE = 'ᢉ';

/** `U+1820 U+180B` → the string. */
const fromCps = (s: string): string =>
  s.trim() === ''
    ? ''
    : String.fromCodePoint(
        ...s
          .trim()
          .split(/\s+/)
          .map((x) => Number.parseInt(x.slice(2), 16)),
      );
/** The string → `U+1820 U+180B`, for readable failures. */
const cps = (s: string): string =>
  [...s]
    .map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' ');

interface Example {
  id: string;
  kind: string;
  source: string;
  tungaamal: string;
  unicode: string;
}
const examples: Example[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/tungaamal-rules.json', import.meta.url)), 'utf8'),
).entries;

describe('the shipped table is the measured table', () => {
  it('carries a worked example for nearly every row', () => {
    expect(examples.length).toBeGreaterThanOrEqual(100);
    const ids = new Set(tungaamalRules.map((r) => r.id));
    for (const e of examples) expect(ids.has(e.id), e.id).toBe(true);
  });

  it('reproduces every proven pair in faithful mode', () => {
    for (const e of examples) {
      const got = rewriteTungaamal(fromCps(e.tungaamal), { faithful: true });
      expect(cps(got.text), `${e.id} (${e.source})`).toBe(e.unicode);
      expect(got.applied, e.id).toContain(e.id);
    }
  });

  it('has no row that could select a form Tungaamal text cannot spell', () => {
    // FVS2 and FVS3 draw an error mark in the Tungaamal fonts, so no row may
    // be conditioned on one — except the one place the fonts accept them,
    // after a medial y.
    for (const r of tungaamalRules) {
      if (r.selector === 'FVS2' || r.selector === 'FVS3') {
        expect(r.letters, r.id).toEqual([0x1836]);
      }
    }
  });
});

describe('the two letters', () => {
  it('turns feminine g and k into the Hudum letters', () => {
    // бичиг and хэрэг as the Tungaamal convention types them. In a feminine word the standard
    // draws the feminine form by itself, so nothing else is needed.
    expect(tungaamalToUnicode(`ᠪᠢᠴᠢ${GE}`)).toBe(toScript('bičig'));
    expect(tungaamalToUnicode(`${KE}ᠡᠷᠡ${GE}`)).toBe(toScript('kereg'));
  });

  it('keeps a feminine letter the writer chose where shaping would not', () => {
    // программ: a feminine g straight after ᠣ. Plain U+182D there is drawn
    // masculine, which is not how the word is written — the bowl takes FVS2.
    const programm = `ᠫᠷᠣ${GE}ᠷᠠᠮᠮ`;
    expect(tungaamalToUnicode(programm)).toBe(`ᠫᠷᠣᠭ${FVS2}ᠷᠠᠮᠮ`);
  });

  it('corrects a masculine letter typed where Mongolian has none', () => {
    // The "incorrect га/гэ": ᠭ typed in front of ᠡ. The Tungaamal fonts draw it
    // masculine, a form the language does not have; the plain letter is what
    // the writer meant, and the standard draws it feminine.
    const typed = 'ᠮᠡᠳᠡᠭᠡ';
    expect(tungaamalToUnicode(typed)).toBe(typed);
    // Faithful mode keeps the slip, dotted, exactly as it was drawn.
    expect(tungaamalToUnicode(typed, { faithful: true })).toBe(`ᠮᠡᠳᠡᠭ${FVS1}ᠡ`);
  });

  it('keeps a masculine coda only in a word that is masculine', () => {
    // англи: ᠭ after ᠩ, where the standard looks at the letter before, finds no
    // vowel and draws the feminine form. The word has an a; the ᠭ is meant.
    expect(tungaamalToUnicode('ᠠᠩᠭᠯᠢ')).toBe(`ᠠᠩᠭ${FVS3}ᠯᠢ`);
    // бичиг typed with the wrong key has no masculine vowel anywhere: a slip.
    expect(tungaamalToUnicode('ᠪᠢᠴᠢᠭ')).toBe('ᠪᠢᠴᠢᠭ');
  });
});

describe('suffixes', () => {
  it('replaces the tungaamal connector and drops the marker the suffix needed', () => {
    // ажлаас as Tungaamal text writes it: NNBSP, then ᠠ + FVS1 to make the a
    // look like a suffix. After MVS the standard shapes it by itself.
    expect(tungaamalToUnicode(`ᠠᠵᠢᠯ${NNBSP}ᠠ${FVS1}ᠴᠠ`)).toBe(toScript('aǰil-ača'));
  });

  it('joins a suffix written as a word of its own', () => {
    // The Tungaamal convention norm: about two case particles in three follow a plain
    // space. To Unicode that is a second word.
    expect(tungaamalToUnicode(`ᠬᠠᠭᠠᠨ ᠤ${FVS1}`)).toBe(toScript('qaγan-u'));
    expect(tungaamalToUnicode(`ᠲᠥᠷᠦ ᠶ${FVS1}ᠢᠨ`)).toBe(toScript('törü-yin'));
  });

  it('joins a stack of them, each on its own connector', () => {
    // өөрсдийгөө — a reader's ruling: accusative then reflexive, no selector.
    const typed = `ᠥᠪᠡᠷᠰᠡᠳ${NNBSP}ᠢ${FVS1} ᠪᠡᠨ`;
    expect(tungaamalToUnicode(typed)).toBe(toScript('öbersed-i-ben'));
  });

  it('writes a suffix after a chachlag without disturbing the chachlag', () => {
    expect(tungaamalToUnicode(`${GE}ᠡᠷ${MVS}ᠡ ᠪᠡᠨ`)).toBe(toScript('ger-e-ben'));
  });

  it('does not mistake the start of a word for a suffix', () => {
    // ᠨᠡᠷ is the plural, and it is also the first three letters of нэр "name",
    // whose detached e follows after an MVS.
    const text = `ᠲᠡᠭᠦᠨ ᠨᠡᠷ${MVS}ᠡ`;
    expect(tungaamalToUnicode(text)).toBe(text);
  });

  it('gives a question particle a space, not a connector', () => {
    // ᠤᠤ is a word. The Tungaamal convention attaches it with NNBSP and marks its first
    // letter like a suffix head; neither survives.
    expect(tungaamalToUnicode(`ᠪᠠᠶᠢᠨ${MVS}ᠠ${NNBSP}ᠤ${FVS1}ᠤ`)).toBe(`${toScript('bain-a')} ᠤᠤ`);
  });

  it('leaves a space between two ordinary words alone', () => {
    const text = 'ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ';
    expect(tungaamalToUnicode(text)).toBe(text);
  });

  it('keeps spaces as spaces in faithful mode', () => {
    const typed = `ᠬᠠᠭᠠᠨ ᠤ${FVS1}`;
    expect(tungaamalToUnicode(typed, { faithful: true })).toBe(typed);
  });
});

describe('the selector is a toggle, and the standard is an index', () => {
  it('moves FVS1 to the selector the standard writes that form with', () => {
    // академи: the two-part d before a vowel is FVS1 in the Tungaamal convention and FVS2 in
    // the standard, whose FVS1 there is the looped d.
    expect(tungaamalToUnicode(`ᠠᠻᠠᠳ${FVS1}ᠧᠮᠢ`)).toBe(`ᠠᠻᠠᠳ${FVS2}ᠧᠮᠢ`);
    // The crownless ü written alone — the genitive as a word — likewise.
    expect(tungaamalToUnicode(`ᠦ${FVS1}`, { faithful: true })).toBe(`ᠦ${FVS2}`);
    // хүү: right after the initial consonant the Tungaamal convention draws the extra tooth
    // by itself and FVS1 takes it away; the standard writes that with FVS3.
    expect(tungaamalToUnicode(`ᠬᠥ${FVS1}ᠦ`)).toBe(`ᠬᠥ${FVS3}ᠦ`);
  });

  it('leaves it where both conventions agree', () => {
    // систем: the upright medial t is FVS1 in both.
    const text = `ᠰᠢᠰᠲ${FVS1}ᠧᠮ`;
    expect(tungaamalToUnicode(text)).toBe(text);
  });

  it('reads a selector typed twice as typed once', () => {
    expect(tungaamalToUnicode(`ᠠᠻᠠᠳ${FVS1}${FVS1}ᠧᠮᠢ`)).toBe(`ᠠᠻᠠᠳ${FVS2}ᠧᠮᠢ`);
  });
});

describe('the double tooth', () => {
  it('drops the y the Tungaamal convention spells a diphthong with', () => {
    // сайн: typed s-a-y-i-n, because that is the only way those fonts draw two
    // teeth. The standard draws them for a + i.
    expect(tungaamalToUnicode('ᠰᠠᠶᠢᠨ')).toBe(toScript('sain'));
    // …and the rarer spelling with the i typed twice.
    expect(tungaamalToUnicode('ᠰᠠᠢᠢᠨ')).toBe(toScript('sain'));
  });

  it('keeps a y that is a consonant', () => {
    // хаяг: marked with FVS1 in the Tungaamal convention precisely so it is NOT the
    // diphthong. The standard's plain y is already that hooked form.
    expect(tungaamalToUnicode(`ᠬᠠᠶ${FVS1}ᠢᠭ`)).toBe('ᠬᠠᠶᠢᠭ');
    // баяр has a vowel after the y, never a diphthong.
    expect(tungaamalToUnicode('ᠪᠠᠶᠠᠷ')).toBe('ᠪᠠᠶᠠᠷ');
  });

  it('does not put dots on a native ши', () => {
    // The standard leaves the dots of ᠱ out before ᠢ. Keeping them is faithful
    // and is not what a reader ruled the text should say.
    expect(tungaamalToUnicode(`ᠵᠢᠱᠢ${GE}`)).toBe('ᠵᠢᠱᠢᠭ');
    expect(tungaamalToUnicode(`ᠵᠢᠱᠢ${GE}`, { faithful: true })).toBe(`ᠵᠢᠱ${FVS2}ᠢᠭ`);
  });
});

describe('everything that is not bichig passes through', () => {
  it('keeps Latin, Cyrillic, digits, punctuation and line breaks', () => {
    const text = `Монгол 2026: ᠮᠣᠩᠭᠣᠯ, "bichig"\n— ᠪᠢᠴᠢ${GE}᠃`;
    expect(tungaamalToUnicode(text)).toBe(`Монгол 2026: ᠮᠣᠩᠭᠣᠯ, "bichig"\n— ᠪᠢᠴᠢᠭ᠃`);
  });

  it('leaves an NNBSP that joins nothing', () => {
    // A tungaamal connector at the end of a line has no MVS reading.
    const text = `ᠮᠣᠩᠭᠣᠯ${NNBSP}`;
    expect(tungaamalToUnicode(text)).toBe(text);
  });

  it('reports which rules fired', () => {
    const { applied } = rewriteTungaamal(`ᠠᠵᠢᠯ${NNBSP}ᠠ${FVS1}ᠴᠠ`);
    expect(applied).toEqual(['SEP-NNBSP', 'SUFFIX']);
  });
});

describe('telling whether a text is the Tungaamal convention at all', () => {
  it('recognises the two letters and the marked suffix', () => {
    const tungaamal = `ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢ${GE} ᠢ${FVS1}ᠶᠡᠷ ᠪᠢᠴᠢᠨ${MVS}ᠡ`;
    const evidence = detectTungaamal(tungaamal);
    expect(evidence.feminineLetters).toBe(1);
    expect(evidence.markedSuffixes).toBe(1);
    expect(evidence.likely).toBe(true);
    expect(isTungaamal(tungaamal)).toBe(true);
  });

  it('does not claim text this package itself produces', () => {
    const ours = [toScript('mongγul'), toScript('bičig-iyer'), toScript('bičin-e')].join(' ');
    expect(detectTungaamal(ours).likely).toBe(false);
    expect(detectTungaamal('Сайн байна уу').likely).toBe(false);
  });

  it('counts FVS2 and FVS3 against it', () => {
    // Those selectors draw an error mark in the Tungaamal fonts, so a text
    // full of them was not typed for those fonts.
    const modern = `ᠪᠢᠴᠢ${GE} ᠠᠻᠠᠳ${FVS2}ᠧᠮᠢ ᠬᠥ${FVS3}ᠦ ᠭ${FVS2}ᠡ ᠭ${FVS3}ᠠ ᠨ${FVS2}ᠠ`;
    expect(detectTungaamal(modern).likely).toBe(false);
  });
});

describe('what an independent review found, 2026-10-02', () => {
  // Each of these was a defect in the first version of the module. Bichig is
  // written through `toScript`, so the invisible characters stay escapes.
  const w = toScript;

  it('turns an NNBSP into MVS before a word that ends in a detached vowel', () => {
    // The run after the connector is followed by an MVS of its own. That made
    // it "not a suffix", and the connector was then left as it was.
    const out = tungaamalToUnicode(`${w('sain')}${NNBSP}${w('bolun')}${MVS}${w('a')}`);
    expect(out).not.toContain(NNBSP);
    expect(out).toBe(`${w('sain')}${MVS}${w('bolun')}${MVS}${w('a')}`);
  });

  it('recognises a suffix that a second, MVS-joined suffix follows', () => {
    // Pages mix the conventions: the first suffix after a space with its FVS1,
    // the second after an MVS. The first is only a suffix once the second is
    // known to be one, which is why the pass runs right to left.
    const typed = `${w('ger')} ᠶ${FVS1}ᠢᠨ${MVS}${w('iyen')}`;
    expect(tungaamalToUnicode(typed)).toBe(`${w('ger')}${MVS}${w('yin')}${MVS}${w('iyen')}`);
    const chained = `${w('γar')}${NNBSP}ᠤ${FVS1}ᠨ${MVS}ᠳ${FVS1}ᠤ`;
    expect(tungaamalToUnicode(chained)).toBe(`${w('γar')}${MVS}${w('un')}${MVS}${w('du')}`);
  });

  it('still leaves a word with a detached vowel alone', () => {
    // ᠨᠡᠷ is the plural and also the first three letters of ner-e, "name".
    const name = `${w('minu')} ${w('ner')}${MVS}${w('e')}`;
    expect(tungaamalToUnicode(name)).toBe(name);
  });

  it('joins a suffix after a closing quote, a bracket and a digit', () => {
    // The head's FVS1 is dropped on the promise that an MVS now shapes the
    // suffix — so the connector must really become one, in both modes.
    for (const faithful of [false, true]) {
      expect(tungaamalToUnicode(`»${NNBSP}ᠶ${FVS1}ᠢᠨ`, { faithful })).toBe(`»${MVS}${w('yin')}`);
      expect(tungaamalToUnicode(`2020${NNBSP}ᠤ${FVS1}ᠨ`, { faithful })).toBe(
        `2020${MVS}${w('un')}`,
      );
    }
    expect(tungaamalToUnicode(`) ᠤ${FVS1}ᠨ`)).toBe(`)${MVS}${w('un')}`);
    // After a comma or at the start of a line it is a word, and is left one.
    expect(tungaamalToUnicode(`, ${w('un')}`)).toBe(`, ${w('un')}`);
  });

  it('spells a suffix the way the registry does, its own MVS included', () => {
    // luγ-a typed joined and typed apart are the one suffix.
    const joined = tungaamalToUnicode(`${w('aqa')}${NNBSP}${w('luγa')}`);
    const apart = tungaamalToUnicode(`${w('aqa')} ${w('luγ')}${MVS}${w('a')}`);
    expect(joined).toBe(`${w('aqa')}${MVS}${w('luγ')}${MVS}${w('a')}`);
    expect(apart).toBe(joined);
  });

  it('passes an abbreviation through, even one whose first letter spells a suffix', () => {
    // УИХ is typed letter + ZWJ + comma, three times. Its ᠤ alone is the
    // genitive, and the space before it was being turned into a connector.
    const ZWJ = '\u200D';
    const acronym = `ᠤ${ZWJ}\u1802ᠢ${ZWJ}\u1802ᠬ${ZWJ}`;
    const typed = `${w('mongγul')} ${acronym}`;
    expect(tungaamalToUnicode(typed)).toBe(typed);
    expect(rewriteTungaamal(typed).applied).not.toContain('JOIN-SUFFIX');
  });

  it('ends a run at ZWNJ', () => {
    // A non-joiner stops joining, so the letters beside it are a final and an
    // initial — two words to the table. Never seen in real Tungaamal text;
    // modelled so it is not wrong. `sain` is the probe because its i is
    // rewritten by position.
    const one = tungaamalToUnicode(w('sain'), { faithful: true });
    const split = tungaamalToUnicode(`${w('sain')}${ZWNJ}${w('sain')}`, { faithful: true });
    expect(split).toBe(`${one}${ZWNJ}${one}`);
  });

  it('converts a page-sized text without overflowing the stack', () => {
    const page = `${w('mongγul')} ᠪᠢᠴᠢ${GE}${NNBSP}ᠢ${FVS1}ᠶᠡᠷ `.repeat(20_000);
    const out = tungaamalToUnicode(page);
    expect([...out].length).toBeGreaterThan(300_000);
    expect(out).not.toContain(NNBSP);
  });

  it('does not take its own faithful output for Tungaamal text', () => {
    // Faithful mode keeps a space-written suffix as typed, FVS1 and all, so a
    // long converted text is full of "marked suffixes" — and has none of the
    // two letters, which real Tungaamal text of that length always does.
    const typed = `${w('ulus')} ᠤ${FVS1}ᠨ ${w('qural')} ᠳ${FVS1}ᠤ ${w('ulus')} ᠶ${FVS1}ᠢᠨ `.repeat(
      12,
    );
    expect(detectTungaamal(typed).letters).toBeGreaterThan(200);
    expect(detectTungaamal(tungaamalToUnicode(typed, { faithful: true })).likely).toBe(false);
    // A short line with marked suffixes and nothing else is still recognised.
    expect(detectTungaamal(`${w('ulus')} ᠤ${FVS1}ᠨ ${w('qural')} ᠳ${FVS1}ᠤ`).likely).toBe(true);
  });
});
