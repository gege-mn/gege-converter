/**
 * A suffix Cyrillic hangs on a hyphen — after a number, an abbreviation, a
 * Latin word or a closing quote — written as it would be on the word the
 * number or abbreviation stands for. See `src/attached.ts` for the rule and
 * for what in it is an assumption.
 */

import { describe, expect, it } from 'vitest';
import { analyze, convert } from '../src/index.js';
import { toScript } from '../src/romanize.js';

const MVS = '\u180E';

/** The suffix's reading, and what the hyphen before it became. */
const attached = (text: string) => {
  const tokens = analyze(text);
  const at = tokens.length - 1;
  return {
    classical: tokens[at]?.candidates[0]?.classical,
    joint: tokens[at - 1]?.token.text,
  };
};

describe('a suffix after a number takes the form the spoken number would', () => {
  it('reads the last word of the number for harmony', () => {
    // 13 ends in гурав, 1 in нэг: the same Cyrillic -нд, two datives.
    expect(attached('13-нд').classical).toBe('du');
    expect(attached('1-нд').classical).toBe('dü');
    expect(attached('40-өөс').classical).toBe('eče');
  });

  it('writes an ending that begins with н on the numeral’s н-form', () => {
    // гуравны is `γurban-u`: the н is the stem's, the suffix is what is left.
    expect(attached('3-ны').classical).toBe('u');
    expect(attached('29-ний').classical).toBe('ü');
    expect(attached('5-наас').classical).toBe('ača');
  });

  it('writes any other ending on the bare numeral', () => {
    // тавын is `tabu-yin`, as the silver writes it spelled out.
    expect(attached('5-ын').classical).toBe('yin');
    expect(attached('10-д').classical).toBe('du');
    // хоёр ends in a hard consonant, so its dative is the t-form.
    expect(attached('2-т').classical).toBe('tu');
  });

  it('looks through a linking г and takes a stack', () => {
    expect(attached('100-гаас').classical).toBe('ača');
    expect(attached('5-ынхаа').classical).toBe('u-ban');
  });

  it('reads only the digits after a decimal point', () => {
    expect(attached('23.1-д').classical).toBe('dü');
  });
});

describe('the hyphen becomes the connector a written word would have', () => {
  it('joins with MVS and drops the hyphen', () => {
    expect(convert('2020-ны')).toBe(`2020${MVS}${toScript('u')}`);
    expect(attached('2020-ны').joint).toBe(MVS);
  });

  it('keeps a closing quote and joins after it', () => {
    const { classical, joint } = attached('«Эрдэнэт»-ийн');
    expect(classical).toBe('ün');
    expect(joint).toBe(`»${MVS}`);
  });
});

describe('a suffix after an abbreviation or a Latin word', () => {
  it('assumes a consonant-final word and takes harmony from the ending', () => {
    // The owner's own example: АНУ is … улс, so `un`.
    expect(attached('АНУ-ын').classical).toBe('un');
    expect(attached('НҮБ-аас').classical).toBe('ača');
    expect(attached('iPhone-ыг').classical).toBe('i');
  });

  it('falls back on the abbreviation’s own letters where the ending has no vowel', () => {
    expect(attached('АНУ-д').classical).toBe('du');
  });
});

describe('what a hyphen is not', () => {
  it('leaves two words joined by a hyphen alone', () => {
    expect(convert('Улаанбаатар-Москва')).toContain('-');
    expect(convert('АНУ-Монгол')).toContain('-');
    expect(convert('2018-2020')).toBe('2018-2020');
  });

  it('leaves an ending that is not a suffix chain alone', () => {
    // The ordinal -р is not in the suffix table, and is not this rule.
    expect(convert('5-р')).toContain('-');
    expect(convert('5-р')).not.toContain(MVS);
  });

  it('does nothing after an ordinary word', () => {
    // Only a number, an abbreviation, a Latin word or a closing quote hosts.
    expect(convert('хот-ын')).toContain('-');
  });
});
