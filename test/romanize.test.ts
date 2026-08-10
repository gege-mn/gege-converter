import { describe, expect, it } from 'vitest';
import { fromScript, isRomanizable, RomanizationError, toScript } from '../src/romanize.js';

/** Code points of a string — assertions use these so no test hard-codes bichig literals. */
const cps = (s: string): number[] => [...s].map((c) => c.codePointAt(0) ?? -1);

describe('toScript', () => {
  it('maps the basic alphabet', () => {
    expect(cps(toScript('nom'))).toEqual([0x1828, 0x1823, 0x182e]);
    expect(cps(toScript('sara'))).toEqual([0x1830, 0x1820, 0x1837, 0x1820]);
  });

  it('reads ng as the ANG ligature, not NA + GA', () => {
    expect(cps(toScript('mongγol'))).toEqual([0x182e, 0x1823, 0x1829, 0x182d, 0x1823, 0x182f]);
  });

  it('forces a letter boundary on "."', () => {
    expect(cps(toScript('n.g'))).toEqual([0x1828, 0x182d]);
  });

  it('turns "-" into MVS (U+180E), the Unicode 16.0 suffix connector', () => {
    expect(cps(toScript('qar-a'))).toEqual([0x182c, 0x1820, 0x1837, 0x180e, 0x1820]);
  });

  it('never emits NNBSP', () => {
    expect(toScript('qota-du')).not.toContain('\u202F');
  });

  it('accepts ASCII aliases for the diacritic letters', () => {
    expect(toScript('gh')).toBe(toScript('γ'));
    expect(toScript('ch')).toBe(toScript('č'));
    expect(toScript('sh')).toBe(toScript('š'));
    expect(toScript('j')).toBe(toScript('ǰ'));
  });

  it('maps the harmony pairs onto one letter each', () => {
    expect(toScript('q')).toBe(toScript('k'));
    expect(toScript('γ')).toBe(toScript('g'));
  });

  it('is case-insensitive', () => {
    expect(toScript('NOM')).toBe(toScript('nom'));
  });

  it('throws on characters outside the Hudum alphabet', () => {
    expect(() => toScript('nom!')).toThrow(RomanizationError);
    // Loan/Ali Gali letters are deliberately unmapped.
    expect(() => toScript('h')).toThrow(RomanizationError);
  });

  it('reports where the failure was', () => {
    try {
      toScript('abh');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RomanizationError);
      expect((error as RomanizationError).offset).toBe(2);
    }
  });
});

describe('isRomanizable', () => {
  it('separates good from bad without throwing', () => {
    expect(isRomanizable('mongγol')).toBe(true);
    expect(isRomanizable('mongol!')).toBe(false);
  });
});

describe('fromScript', () => {
  it('round-trips a masculine word', () => {
    expect(fromScript(toScript('qota'), 'masculine')).toBe('qota');
  });

  it('picks the front readings for feminine words', () => {
    expect(fromScript(toScript('kele'), 'feminine')).toBe('kele');
    expect(fromScript(toScript('ger'), 'feminine')).toBe('ger');
  });

  it('round-trips MVS back to "-"', () => {
    expect(fromScript(toScript('qar-a'), 'masculine')).toBe('qar-a');
  });
});
