/**
 * `verbEnding` recognises Khalkha verb endings; it converts nothing.
 *
 * The point is honesty, not capability: 48.5% of the guesser's output over
 * real running text is verb-shaped, so this marks the converter's single
 * largest blind spot rather than pretending it is ordinary uncertainty.
 */

import { describe, expect, it } from 'vitest';
import { analyze, segment, verbEnding } from '../src/index.js';

describe('verbEnding', () => {
  it('names the ending it matched', () => {
    expect(verbEnding('хүлээгээд')).toEqual({ kind: 'converb-perfective', ending: 'ээд' });
    expect(verbEnding('ангижрасан')).toEqual({ kind: 'participle-past', ending: 'сан' });
    expect(verbEnding('мэддэг')).toEqual({ kind: 'participle-habitual', ending: 'дэг' });
    expect(verbEnding('байвал')).toEqual({ kind: 'converb-conditional', ending: 'вал' });
    expect(verbEnding('дуустал')).toEqual({ kind: 'converb-terminative', ending: 'тал' });
    expect(verbEnding('барина')).toEqual({ kind: 'tense-present', ending: 'на' });
    expect(verbEnding('ярилцлаа')).toEqual({ kind: 'tense-past', ending: 'лаа' });
    expect(verbEnding('болжээ')).toEqual({ kind: 'evidential', ending: 'жээ' });
    expect(verbEnding('оруулж')).toEqual({ kind: 'converb-imperfective', ending: 'ж' });
  });

  it('prefers the longer ending when two could match', () => {
    // Both end in -сон; -гүй is the real ending and negates the whole form.
    expect(verbEnding('очсонгүй')?.kind).toBe('negative');
    // -жээ is evidential, not the bare -ж converb.
    expect(verbEnding('бичжээ')?.kind).toBe('evidential');
  });

  it('leaves ordinary nouns alone', () => {
    for (const word of ['хот', 'ном', 'гэр', 'мэргэжил', 'толгой', 'ажил']) {
      expect(verbEnding(word), word).toBeUndefined();
    }
  });

  it('needs a base to work with', () => {
    // Bare `ч` is the concessive particle, not a converb.
    expect(verbEnding('ч')).toBeUndefined();
    expect(verbEnding('на')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(verbEnding('БАЙНА')?.kind).toBe('tense-present');
  });
});

/**
 * The habitual participle is the one verb ending whose final letter is also a
 * case suffix, so bare `-г` accusative must not carve it up: ажилладаг is
 * -даг, not `aǰilla` + dative + accusative.
 *
 * Deliberately narrow. Guarding *every* verb ending was measured on 2026-07-27
 * and cost exactly what it saved (+16 net → 0), because `-лаа/-лээ` is usually
 * an ordinary noun plus the reflexive — сэтгэл + ээ, ажил + аа — and blocking
 * that reading breaks words this suite asserts elsewhere.
 */
describe('bare -г accusative does not split the habitual participle', () => {
  const chains = (word: string) =>
    segment(word).map((s) => s.suffixes.map((x) => x.cyrillic).join('+'));

  it('refuses the accusative reading of a -даг form', () => {
    for (const word of ['ажилладаг', 'уядаг', 'мэддэг', 'харагддаг', 'өмсдөг']) {
      expect(chains(word), word).not.toContain('г');
    }
  });

  it('still offers bare -г on an ordinary vowel-final noun', () => {
    for (const word of ['мэдээг', 'санааг', 'дууг', 'хүрээг']) {
      expect(chains(word), word).toContain('г');
    }
  });

  it('leaves the past-tense shape alone — those are noun + reflexive', () => {
    // The regression the narrow guard exists to avoid.
    expect(chains('сэтгэлээ')).toContain('ээ');
    expect(chains('ажлаа')).toContain('аа');
  });
});

describe('analyze surfaces the verb ending', () => {
  it('sets verbForm on a verb-shaped word', () => {
    const [token] = analyze('хүлээгээд');
    expect(token?.verbForm).toEqual({ kind: 'converb-perfective', ending: 'ээд' });
  });

  it('omits verbForm for an ordinary noun', () => {
    const [token] = analyze('хотод');
    expect(token?.verbForm).toBeUndefined();
  });

  it('leaves non-word tokens alone', () => {
    for (const token of analyze('хот, ном')) {
      if (token.token.kind !== 'word') expect(token.verbForm).toBeUndefined();
    }
  });

  it('still returns candidates — the flag annotates, it does not suppress', () => {
    const [token] = analyze('хүлээгээд');
    expect(token?.candidates.length).toBeGreaterThan(0);
  });
});
