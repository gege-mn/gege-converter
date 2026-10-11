import { describe, expect, it } from 'vitest';
import { convert, renderPunctuation } from '../src/index.js';

const HYPHEN = '\u1806';

describe('the hyphen of a compound name', () => {
  it('is the Mongolian hyphen, unspaced, under mongolian punctuation', () => {
    const out = convert('Алтан-Од', { punctuation: 'mongolian' });
    expect(out).toContain(HYPHEN);
    expect(out).not.toMatch(/[- ]/);
  });

  it('stays as typed under the default ascii punctuation', () => {
    expect(convert('Алтан-Од')).toContain('-');
    expect(convert('Алтан-Од')).not.toContain(HYPHEN);
  });

  it('is left alone when it is not between two words', () => {
    expect(convert('3-5', { punctuation: 'mongolian' })).not.toContain(HYPHEN);
    expect(convert('ах - дүү', { punctuation: 'mongolian' })).not.toContain(HYPHEN);
    expect(convert('НҮБ-д', { punctuation: 'mongolian' })).not.toContain(HYPHEN);
    expect(convert('АНУ-ын', { punctuation: 'mongolian' })).not.toContain(HYPHEN);
    expect(convert('хэл-соёл', { punctuation: 'mongolian' })).not.toContain(HYPHEN);
  });

  it('reads back as an ASCII hyphen', () => {
    expect(renderPunctuation(HYPHEN, 'ascii')).toBe('-');
  });
});
