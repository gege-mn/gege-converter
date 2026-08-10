import { describe, expect, it } from 'vitest';
import { tokenize } from '../src/tokenize.js';

describe('tokenize', () => {
  it('splits words from spaces and punctuation', () => {
    expect(tokenize('хот, гэр').map((t) => [t.kind, t.text])).toEqual([
      ['word', 'хот'],
      ['punctuation', ','],
      ['space', ' '],
      ['word', 'гэр'],
    ]);
  });

  it('classifies numbers and Latin runs separately', () => {
    expect(tokenize('хот 2026 abc').map((t) => t.kind)).toEqual([
      'word',
      'space',
      'number',
      'space',
      'latin',
    ]);
  });

  it('reports offsets in code points, not UTF-16 units', () => {
    // The emoji is one code point but two UTF-16 units; the following word
    // must still start at index 2.
    const tokens = tokenize('🐎 хот');
    const word = tokens.find((t) => t.kind === 'word');
    expect(word?.start).toBe(2);
    expect(word?.end).toBe(5);
  });

  it('covers the whole input with no gaps', () => {
    const text = 'Монгол бичиг, 2026.';
    const tokens = tokenize(text);
    expect(tokens.map((t) => t.text).join('')).toBe(text);
    for (let i = 1; i < tokens.length; i += 1) {
      expect(tokens[i]?.start).toBe(tokens[i - 1]?.end);
    }
  });

  it('returns nothing for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});
