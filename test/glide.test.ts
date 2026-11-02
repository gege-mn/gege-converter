import { describe, expect, it } from 'vitest';
import { harvestedLexicon } from '../src/data/harvested-lexicon.js';
import { lexicon } from '../src/data/lexicon.js';
import { toliIndex } from '../src/data/toli-lexicon.js';
import { analyze, convert } from '../src/index.js';
import { toScript } from '../src/romanize.js';
import { guessStem } from '../src/stem.js';

/**
 * Ruled 2026-11-03: Cyrillic -ъяа / -ьяа / -ия / -иа / -ъя / -ья on a word the
 * data does not have is written i + y + MVS + a at the end of the word, and
 * i + y + a joined when more follows. Never ii before the detached vowel.
 * Expectations are romanizations run through `toScript`, so no connector is
 * ever typed here.
 */
const MVS = '\u180E';
const top = (word: string) => analyze(word)[0]?.candidates[0];

describe('glide — the guesser writes i + y before я / а / е', () => {
  it.each([
    ['Сумъяа', 'sumiy-a'],
    ['Адъяа', 'adiy-a'],
    ['Дарьяа', 'dariy-a'],
    ['Азия', 'aǰiy-a'],
    ['Мария', 'mariy-a'],
    ['Гүнъяа', 'güniy-a'],
    ['Сүндэръяа', 'sünderiy-a'],
  ])('%s ends %s, detached', (word, classical) => {
    const c = top(word);
    expect(c?.provenance).toBe('guess');
    expect(c?.script).toBe(toScript(classical));
  });

  it.each([
    ['Сумъяабазар', 'sumiyabaǰar'],
    ['Адъяасүрэн', 'adiyasüren'],
  ])('%s joins the vowel inside the word: %s', (word, classical) => {
    expect(convert(word)).toBe(toScript(classical));
    expect(convert(word)).not.toContain(MVS);
  });

  it('never writes ii before the detached vowel', () => {
    for (const word of ['Сумъяа', 'Дарьяа', 'Азия', 'Мария', 'Сүндэръяа']) {
      expect(convert(word)).not.toContain(`ᠢᠢ${MVS}`);
      expect(convert(word)).toContain(`ᠢᠶ${MVS}`);
    }
  });

  it('takes the vowel from the Cyrillic letter, not from harmony', () => {
    // A feminine word keeps я's a, as биндэрьяа `bindüriy-a` does in the data.
    expect(guessStem('сүндэръяа')).toBe('sünderiy-a');
    expect(guessStem('сүрьеэ')).toBe('süriy-e');
    expect(guessStem('мөнхье')).toBe('möngkiy-e');
  });

  it('covers и + а after a consonant, as the attested уриа and мушгиа spell it', () => {
    expect(guessStem('уриа')).toBe('uriy-a');
    expect(guessStem('мушгиа')).toBe('mušγiy-a');
    expect(guessStem('алиал')).toBe('aliyal');
  });

  it('absorbs the length mark after the glide vowel', () => {
    expect(guessStem('мариаа')).toBe('mariy-a');
    expect(guessStem('марияа')).toBe('mariy-a');
  });

  it('writes no i after a vowel, and leaves a bare final ь as it was', () => {
    expect(guessStem('аяар')).toBe('ayar');
    expect(guessStem('хаяъя')).toBe('qayaya');
    expect(guessStem('морь')).toBe('mori');
  });

  it('keeps a suffix after the detached vowel on its own connector', () => {
    expect(convert('Сумъяад')).toBe(toScript('sumiy-a-du'));
    expect(convert('Мариягаа')).toBe(toScript('mariy-a-ban'));
  });

  it('does not touch words the data has', () => {
    expect(convert('яриа')).toBe(toScript('yariy-a'));
    expect(convert('жишээ')).toBe(toScript('ǰišiy-e'));
    expect(top('яриа')?.provenance).not.toBe('guess');
  });
});

describe('glide — the data never spells ii before a detached a/e', () => {
  it('holds for every tier', () => {
    const iiA = /ii-[ae](?![a-zγǰčšēöü])/u;
    const rows = [
      ...lexicon.map((r) => r.classical),
      ...harvestedLexicon.map((r) => r.classical),
      ...[...toliIndex.values()].flat(),
    ];
    expect(rows.filter((c) => iiA.test(c))).toEqual([]);
    expect(convert('харьяа')).toBe(toScript('qariy-a'));
  });
});
