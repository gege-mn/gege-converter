import { describe, expect, test } from 'vitest';
import { convert, renderDigits, renderPunctuation } from '../src/index.js';
import { tokenize } from '../src/tokenize.js';

/** `U+1823`-style label, so a failure names the code point instead of showing a dot. */
const uplus = (s: string): string =>
  [...s]
    .map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' ');

describe('digits', () => {
  test('ASCII → Mongolian covers the whole contiguous range', () => {
    expect(uplus(renderDigits('0123456789', 'mongolian'))).toBe(
      'U+1810 U+1811 U+1812 U+1813 U+1814 U+1815 U+1816 U+1817 U+1818 U+1819',
    );
  });

  test('round-trips', () => {
    expect(renderDigits(renderDigits('2026', 'mongolian'), 'ascii')).toBe('2026');
  });

  test('is idempotent, so mixed input converges instead of double-shifting', () => {
    const once = renderDigits('2026', 'mongolian');
    expect(renderDigits(once, 'mongolian')).toBe(once);
  });

  test('leaves non-digits alone', () => {
    expect(renderDigits('a-b.c', 'mongolian')).toBe('a-b.c');
  });
});

describe('punctuation', () => {
  test('maps only the five supported marks', () => {
    expect(uplus(renderPunctuation(',', 'mongolian'))).toBe('U+1802');
    expect(uplus(renderPunctuation('.', 'mongolian'))).toBe('U+1803');
    expect(uplus(renderPunctuation('?', 'mongolian'))).toBe('U+FF1F');
    expect(uplus(renderPunctuation('!', 'mongolian'))).toBe('U+FF01');
  });

  test('collapses ASCII "..." into one ellipsis', () => {
    expect(uplus(renderPunctuation('...', 'mongolian'))).toBe('U+1801');
  });

  test('passes through marks with no documented counterpart', () => {
    // U+1804 COLON is documented nowhere; birga and four dots mean things no
    // ASCII character means. Approximating any of them would be a guess.
    expect(renderPunctuation(':;()"-', 'mongolian')).toBe(':;()"-');
  });

  test('round-trips', () => {
    expect(renderPunctuation(renderPunctuation(',.?!', 'mongolian'), 'ascii')).toBe(',.?!');
  });
});

describe('convert', () => {
  test('changes nothing about digits or punctuation by default', () => {
    // ᠣᠨ + MVS + ᠳᠤ — the connector is written as an escape, never a literal.
    expect(convert('2026 онд, 5 хүн.')).toBe('2026 ᠣᠨ\u180Eᠳᠤ, 5 ᠬᠦᠮᠦᠨ.');
  });

  test('converts both when asked', () => {
    const out = convert('2026 онд, 5 хүн.', { digits: 'mongolian', punctuation: 'mongolian' });
    expect(out).toContain(String.fromCodePoint(0x1812)); // MONGOLIAN DIGIT TWO
    expect(out).toContain(String.fromCodePoint(0x1802)); // MONGOLIAN COMMA
    expect(out).toContain(String.fromCodePoint(0x1803)); // MONGOLIAN FULL STOP
    expect(out).not.toMatch(/[0-9,.]/);
  });

  test('the two styles are independent', () => {
    const out = convert('5 хүн.', { digits: 'mongolian' });
    expect(out).toContain(String.fromCodePoint(0x1815));
    expect(out).toContain('.'); // punctuation left ASCII
  });

  test('never invents a transliteration for Latin', () => {
    expect(convert('HTML код', { punctuation: 'mongolian' })).toContain('HTML');
  });
});

describe('tokenize', () => {
  test('reads Mongolian digits as numbers, not as punctuation', () => {
    // U+1811 U+1812. Before this, the local isDigit was ASCII-only and these
    // fell through to `punctuation`, where the digit policy never saw them.
    const kinds = tokenize('᠑᠒').map((t) => t.kind);
    expect(kinds).toEqual(['number']);
  });

  test('so a traditional-digit document can be normalised back to ASCII', () => {
    expect(convert('᠒᠐᠒᠖', { digits: 'ascii' })).toBe('2026');
  });
});
